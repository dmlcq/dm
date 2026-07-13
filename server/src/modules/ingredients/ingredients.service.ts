import { Injectable } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import * as crypto from 'crypto'

// 人群身份类型
export type IdentityType = 'adult' | 'pregnant' | 'child'

// 配料分析结果类型
export interface Ingredient {
  name: string
  riskLevel: 'safe' | 'warning' | 'danger'
  description: string
  alternatives?: string
}

export interface AnalysisResult {
  score: number
  recommendation: 'recommend' | 'caution' | 'avoid'
  ingredients: Ingredient[]
  summary: string
  identity?: IdentityType  // 分析使用的身份
}

// 数据库记录类型
export interface ScanHistoryRecord {
  id: string
  image_key: string
  image_url: string
  product_name?: string
  content_hash?: string
  identity: IdentityType
  content_identity_hash?: string
  health_score: number
  recommendation: string
  ingredients: Ingredient[]
  created_at: string
}

// 内存缓存项
interface CacheItem {
  result: AnalysisResult
  imageUrl: string
  contentIdentityHash: string  // 配料内容 + 身份组合 hash
  identity: IdentityType
  timestamp: number
}

// 身份人群的健康提示
const IDENTITY_PROMPTS: Record<IdentityType, string> = {
  adult: `
【成人健康标准】
- 大部分添加剂在适量范围内可以接受
- 关注长期过量摄入的风险（如糖分、钠、人工添加剂）
- warning 级配料标注风险即可，不需完全避免
- 主要控制摄入量，而非完全禁止`,
  
  pregnant: `
【孕妇健康标准 - 严格谨慎】
- 许多添加剂对胎儿发育可能有影响，需严格避免
- 以下成分必须标记为 danger：
  * 咖啡因及其衍生物（影响胎儿发育）
  * 人工色素（如焦糖色、日落黄等）
  * 防腐剂（如苯甲酸钠、山梨酸钾）
  * 人工甜味剂（阿斯巴甜、糖精钠）
  * 反式脂肪酸来源（氢化植物油、起酥油）
  * 亚硝酸盐类（硝酸钠、亚硝酸钠）
- 天然配料可标注 safe，但有添加剂需从严判断
- 即使是 warning 级配料也要建议孕妇避免`,
  
  child: `
【儿童健康标准 - 成长保护】
- 儿童生长发育敏感，部分添加剂需禁止或限制
- 以下成分必须标记为 danger：
  * 人工色素（尤其鲜艳色彩的糖果饮料）
  * 过量糖分（导致龋齿、肥胖）
  * 咖啡因及其衍生物
  * 亚硝酸盐类防腐剂
- 以下成分标记为 warning：
  * 防腐剂（苯甲酸钠、山梨酸钾等）
  * 人工甜味剂（建议儿童减少摄入）
  * 增味剂（味精等，儿童不宜过量）
- 天然食材、基础配料可标注 safe
- 评分时对添加剂从严扣分`
}

@Injectable()
export class IngredientsService {
  private storage: S3Storage
  private llmClient: LLMClient
  private supabase = getSupabaseClient()
  
  // 内存缓存（TTL: 30分钟）
  private memoryCache = new Map<string, CacheItem>()
  private CACHE_TTL = 30 * 60 * 1000 // 30分钟

  constructor() {
    // 初始化对象存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing'
    })

    // 初始化LLM客户端
    const config = new Config()
    this.llmClient = new LLMClient(config)
    
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 5 * 60 * 1000)
  }

  // 清理过期缓存
  private cleanExpiredCache() {
    const now = Date.now()
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > this.CACHE_TTL) {
        this.memoryCache.delete(key)
        console.log('清理过期缓存:', key)
      }
    }
  }

  /**
   * 生成配料内容 + 身份的组合 hash
   * 不同身份的人群对相同配料的分析结果不同，因此缓存 key 需包含身份
   */
  private generateContentIdentityHash(ingredients: Ingredient[], identity: IdentityType): string {
    // 提取配料名称，标准化处理
    const normalizedNames = ingredients
      .map(ing => ing.name.trim().toLowerCase())
      .filter(name => name.length > 0)
      .sort()  // 排序，避免顺序不同
    
    // 拼接：配料内容 + 身份标识
    const contentString = normalizedNames.join('|') + `#${identity}`
    
    // 生成 SHA256 hash
    const hash = crypto.createHash('sha256').update(contentString).digest('hex')
    
    console.log('生成内容+身份 hash:', { 
      identity,
      ingredientsCount: ingredients.length,
      hash 
    })
    
    return hash
  }

  // 生成纯配料内容 hash（用于统计相同配料的不同身份分析）
  private generateContentHash(ingredients: Ingredient[]): string {
    const normalizedNames = ingredients
      .map(ing => ing.name.trim().toLowerCase())
      .filter(name => name.length > 0)
      .sort()
    
    return crypto.createHash('sha256').update(normalizedNames.join('|')).digest('hex')
  }

  // 上传图片到对象存储
  async uploadImage(file: Express.Multer.File) {
    const fileKey = await this.storage.uploadFile({
      fileContent: file.buffer,
      fileName: `ingredients/${Date.now()}_${file.originalname}`,
      contentType: file.mimetype
    })

    // 生成可访问的URL
    const imageUrl = await this.storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 // 1天有效期
    })

    console.log('图片上传成功:', { fileKey, imageUrl })

    return { imageKey: fileKey, imageUrl }
  }

  // 分析配料表（带缓存 - 以配料内容+身份为 Key）
  async analyzeIngredients(
    imageKey: string, 
    identity: IdentityType = 'adult'
  ): Promise<AnalysisResult & { cached?: boolean }> {
    // 1. 生成缓存 key（imageKey + identity）
    const cacheKey = `${imageKey}#${identity}`
    
    // 2. 先检查内存缓存
    const memoryCached = this.memoryCache.get(cacheKey)
    if (memoryCached && Date.now() - memoryCached.timestamp < this.CACHE_TTL) {
      console.log('命中内存缓存:', cacheKey)
      return { ...memoryCached.result, cached: true }
    }

    // 3. 调用 LLM 分析（获取配料内容）
    console.log('开始LLM分析:', { imageKey, identity })
    const result = await this.analyzeWithLLM(imageKey, identity)

    // 4. 生成组合 hash
    const contentIdentityHash = this.generateContentIdentityHash(result.ingredients, identity)
    const contentHash = this.generateContentHash(result.ingredients)

    // 5. 用 contentIdentityHash 查询数据库缓存
    const { data: existingRecord, error: queryError } = await this.supabase
      .from('scan_history')
      .select('*')
      .eq('content_identity_hash', contentIdentityHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) {
      console.error('查询历史记录失败:', queryError.message)
    }

    if (existingRecord) {
      console.log('命中数据库缓存:', contentIdentityHash, '身份:', identity)
      
      const cachedResult: AnalysisResult = {
        score: existingRecord.health_score,
        recommendation: existingRecord.recommendation as AnalysisResult['recommendation'],
        ingredients: existingRecord.ingredients as Ingredient[],
        summary: `该配料表已有${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}分析记录`,
        identity: existingRecord.identity as IdentityType
      }
      
      // 写入内存缓存
      const imageUrl = await this.storage.generatePresignedUrl({
        key: imageKey,
        expireTime: 86400
      })
      this.memoryCache.set(cacheKey, {
        result: cachedResult,
        imageUrl,
        contentIdentityHash,
        identity,
        timestamp: Date.now()
      })
      
      return { ...cachedResult, cached: true }
    }

    // 6. 新分析结果，保存到数据库
    const imageUrl = await this.storage.generatePresignedUrl({
      key: imageKey,
      expireTime: 86400
    })

    const { error: insertError } = await this.supabase
      .from('scan_history')
      .insert({
        image_key: imageKey,
        image_url: imageUrl,
        content_hash: contentHash,
        identity: identity,
        content_identity_hash: contentIdentityHash,
        health_score: result.score,
        recommendation: result.recommendation,
        ingredients: result.ingredients
      })

    if (insertError) {
      console.error('保存分析记录失败:', insertError.message)
    } else {
      console.log('分析记录已保存, 身份:', identity, 'hash:', contentIdentityHash)
    }

    // 7. 写入内存缓存
    this.memoryCache.set(cacheKey, {
      result: { ...result, identity },
      imageUrl,
      contentIdentityHash,
      identity,
      timestamp: Date.now()
    })

    return { ...result, identity, cached: false }
  }

  // 使用多模态LLM分析配料表图片（根据身份定制分析）
  private async analyzeWithLLM(imageKey: string, identity: IdentityType): Promise<AnalysisResult> {
    // 获取图片预签名URL（LLM需要可访问的URL，有效期1小时）
    const imageUrl = await this.storage.generatePresignedUrl({
      key: imageKey,
      expireTime: 3600
    })

    console.log('开始分析配料表:', { imageUrl, identity })

    // 根据身份选择健康标准提示
    const identityPrompt = IDENTITY_PROMPTS[identity]

    // 构建系统提示词
    const systemPrompt = `你是一位专业的食品安全分析师，专门针对${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}群体进行配料安全分析。

${identityPrompt}

请分析用户提供的食品配料表图片，识别所有配料并根据${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}健康标准评估风险。

请严格按照以下JSON格式返回分析结果，不要包含任何其他文字：
{
  "score": 数字(0-100的健康评分，根据${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}标准),
  "recommendation": "recommend/caution/avoid"(对${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}的推荐程度),
  "ingredients": [
    {
      "name": "配料名称",
      "riskLevel": "safe/warning/danger",
      "description": "简要说明该配料对${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}的作用和安全性",
      "alternatives": "更适合${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}的替代建议(仅对warning和danger的配料提供)"
    }
  ],
  "summary": "一句话总结，针对${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}的建议"
}

风险评估标准：
- safe(安全)：对该人群无健康风险，可以放心食用
- warning(注意)：有一定风险，需控制摄入量或谨慎食用
- danger(高风险)：对该人群有明显健康风险，建议避免`

    // 构建消息
    const messages = [
      {
        role: 'system' as 'system',
        content: systemPrompt
      },
      {
        role: 'user' as 'user',
        content: [
          { type: 'text' as 'text', text: `请分析这张食品配料表图片，从${identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'}健康角度评估每种配料的风险。` },
          {
            type: 'image_url' as 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high' as 'high'
            }
          }
        ]
      }
    ]

    // 调用多模态LLM
    const response = await this.llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3
    })

    console.log('LLM响应:', response.content)

    // 解析JSON响应
    try {
      let jsonContent = response.content.trim()
      
      if (jsonContent.includes('```json')) {
        const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) jsonContent = jsonMatch[1]
      } else if (jsonContent.includes('```')) {
        const jsonMatch = jsonContent.match(/```\s*([\s\S]*?)\s*```/)
        if (jsonMatch) jsonContent = jsonMatch[1]
      }

      const parsed = JSON.parse(jsonContent) as AnalysisResult
      
      return {
        score: parsed.score ?? 50,
        recommendation: parsed.recommendation ?? 'caution',
        ingredients: parsed.ingredients ?? [],
        summary: parsed.summary ?? '请查看配料详情'
      }
    } catch (error) {
      console.error('解析LLM响应失败:', error)
      
      return {
        score: 50,
        recommendation: 'caution',
        ingredients: [],
        summary: '分析结果解析失败，请重新上传清晰的配料表图片'
      }
    }
  }

  // 获取历史记录列表
  async getHistory(limit: number = 20, identity?: IdentityType): Promise<ScanHistoryRecord[]> {
    let query = this.supabase
      .from('scan_history')
      .select('id, image_key, image_url, product_name, content_hash, identity, content_identity_hash, health_score, recommendation, ingredients, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    // 按身份筛选
    if (identity) {
      query = query.eq('identity', identity)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`获取历史记录失败: ${error.message}`)
    }

    return (data || []) as ScanHistoryRecord[]
  }

  // 获取单条历史记录详情
  async getHistoryDetail(id: string): Promise<ScanHistoryRecord | null> {
    const { data, error } = await this.supabase
      .from('scan_history')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(`获取历史详情失败: ${error.message}`)
    }

    return data as ScanHistoryRecord | null
  }

  // 删除历史记录
  async deleteHistory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('scan_history')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`删除记录失败: ${error.message}`)
    }
    console.log('历史记录已删除:', id)
  }
}