import { Injectable } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '@/storage/database/supabase-client'

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
}

// 数据库记录类型
export interface ScanHistoryRecord {
  id: string
  image_key: string
  image_url: string
  product_name?: string
  health_score: number
  recommendation: string
  ingredients: Ingredient[]
  created_at: string
}

// 内存缓存项
interface CacheItem {
  result: AnalysisResult
  imageUrl: string
  timestamp: number
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

  // 分析配料表（带缓存）
  async analyzeIngredients(imageKey: string): Promise<AnalysisResult & { cached?: boolean }> {
    // 1. 先检查内存缓存
    const memoryCached = this.memoryCache.get(imageKey)
    if (memoryCached && Date.now() - memoryCached.timestamp < this.CACHE_TTL) {
      console.log('命中内存缓存:', imageKey)
      return { ...memoryCached.result, cached: true }
    }

    // 2. 检查数据库缓存
    const { data: dbCached, error: dbError } = await this.supabase
      .from('scan_history')
      .select('*')
      .eq('image_key', imageKey)
      .maybeSingle()

    if (dbError) {
      console.error('数据库查询失败:', dbError.message)
    }

    if (dbCached) {
      console.log('命中数据库缓存:', imageKey)
      const result: AnalysisResult = {
        score: dbCached.health_score,
        recommendation: dbCached.recommendation as AnalysisResult['recommendation'],
        ingredients: dbCached.ingredients as Ingredient[],
        summary: `历史分析记录 (${new Date(dbCached.created_at).toLocaleDateString()})`
      }
      // 写入内存缓存
      this.memoryCache.set(imageKey, {
        result,
        imageUrl: dbCached.image_url,
        timestamp: Date.now()
      })
      return { ...result, cached: true }
    }

    // 3. 未命中缓存，调用LLM分析
    console.log('开始LLM分析:', imageKey)
    const result = await this.analyzeWithLLM(imageKey)

    // 4. 保存到数据库
    const imageUrl = await this.storage.generatePresignedUrl({
      key: imageKey,
      expireTime: 86400
    })

    const { error: insertError } = await this.supabase
      .from('scan_history')
      .insert({
        image_key: imageKey,
        image_url: imageUrl,
        health_score: result.score,
        recommendation: result.recommendation,
        ingredients: result.ingredients
      })

    if (insertError) {
      console.error('保存分析记录失败:', insertError.message)
    } else {
      console.log('分析记录已保存到数据库')
    }

    // 5. 写入内存缓存
    this.memoryCache.set(imageKey, {
      result,
      imageUrl,
      timestamp: Date.now()
    })

    return { ...result, cached: false }
  }

  // 使用多模态LLM分析配料表图片
  private async analyzeWithLLM(imageKey: string): Promise<AnalysisResult> {
    // 获取图片URL
    const imageUrl = await this.storage.generatePresignedUrl({
      key: imageKey,
      expireTime: 3600 // 1小时有效期用于分析
    })

    console.log('开始分析配料表:', imageUrl)

    // 构建多模态消息
    const systemPrompt = `你是一位专业的食品安全分析师。请分析用户提供的食品配料表图片，识别所有配料并评估其健康风险。

请严格按照以下JSON格式返回分析结果，不要包含任何其他文字：
{
  "score": 数字(0-100的健康评分),
  "recommendation": "recommend/caution/avoid"(推荐购买/谨慎购买/不建议购买),
  "ingredients": [
    {
      "name": "配料名称",
      "riskLevel": "safe/warning/danger",
      "description": "简要说明该配料的作用和安全性",
      "alternatives": "更健康的替代建议(仅对warning和danger的配料提供)"
    }
  ],
  "summary": "一句话总结建议"
}

风险评估标准：
- safe(安全)：天然食材、常见营养成分、无已知风险
- warning(注意)：人工添加剂、防腐剂、可能敏感人群需注意
- danger(高风险)：已知有害添加剂、反式脂肪来源、致癌物质、建议避免

评分标准：
- 90-100：配料表非常健康，主要是天然食材
- 70-89：配料表较健康，有少量添加剂但风险可控
- 50-69：配料表一般，有较多添加剂需注意
- 0-49：配料表不健康，建议避免购买`

    // 使用类型安全的方式构建消息
    const messages = [
      {
        role: 'system' as 'system',
        content: systemPrompt
      },
      {
        role: 'user' as 'user',
        content: [
          { type: 'text' as 'text', text: '请分析这张食品配料表图片，识别所有配料并评估健康风险。' },
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
      temperature: 0.3 // 低温度确保结构化输出稳定
    })

    console.log('LLM响应:', response.content)

    // 解析JSON响应
    try {
      // 提取JSON内容（可能包含markdown代码块）
      let jsonContent = response.content.trim()
      
      // 如果包含markdown代码块，提取其中的JSON
      if (jsonContent.includes('```json')) {
        const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonContent = jsonMatch[1]
        }
      } else if (jsonContent.includes('```')) {
        const jsonMatch = jsonContent.match(/```\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonContent = jsonMatch[1]
        }
      }

      const result = JSON.parse(jsonContent) as AnalysisResult
      
      // 验证并补充默认值
      return {
        score: result.score ?? 50,
        recommendation: result.recommendation ?? 'caution',
        ingredients: result.ingredients ?? [],
        summary: result.summary ?? '请查看配料详情'
      }
    } catch (error) {
      console.error('解析LLM响应失败:', error)
      
      // 返回默认结果
      return {
        score: 50,
        recommendation: 'caution',
        ingredients: [],
        summary: '分析结果解析失败，请重新上传清晰的配料表图片'
      }
    }
  }

  // 获取历史记录列表
  async getHistory(limit: number = 20): Promise<ScanHistoryRecord[]> {
    const { data, error } = await this.supabase
      .from('scan_history')
      .select('id, image_key, image_url, product_name, health_score, recommendation, ingredients, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

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