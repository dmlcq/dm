import { Injectable } from '@nestjs/common'
import { S3Storage } from 'coze-coding-dev-sdk'
import { LLMClient, Config } from 'coze-coding-dev-sdk'

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

@Injectable()
export class IngredientsService {
  private storage: S3Storage
  private llmClient: LLMClient

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

  // 使用多模态LLM分析配料表图片
  async analyzeIngredients(imageKey: string): Promise<AnalysisResult> {
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
}