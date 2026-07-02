/**
 * 配料表AI分析云函数
 * 功能：上传图片 → LLM分析 → 保存结果 → 返回分析报告
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 缓存 Map（内存缓存，30分钟有效）
const memoryCache = new Map()
const CACHE_TTL = 30 * 60 * 1000 // 30分钟

/**
 * 生成配料内容 hash（用于缓存 key）
 */
function generateContentHash(ingredients, identity) {
  const names = ingredients.map(i => i.name).sort()
  const normalized = names.join('|').toLowerCase().replace(/\s+/g, '')
  return `${normalized}_${identity}`
}

/**
 * 从缓存获取结果
 */
async function getFromCache(contentHash) {
  // 1. 检查内存缓存
  const memCached = memoryCache.get(contentHash)
  if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
    console.log('命中内存缓存:', contentHash)
    return { data: memCached.data, cached: true }
  }

  // 2. 检查数据库缓存
  const dbResult = await db.collection('scan_history')
    .where({ contentHash })
    .orderBy('createTime', 'desc')
    .limit(1)
    .get()

  if (dbResult.data.length > 0) {
    console.log('命中数据库缓存:', contentHash)
    // 同时写入内存缓存
    memoryCache.set(contentHash, {
      data: dbResult.data[0],
      timestamp: Date.now()
    })
    return { data: dbResult.data[0], cached: true }
  }

  return null
}

/**
 * 获取身份特定的分析提示
 */
function getIdentityPrompt(identity) {
  const prompts = {
    child: `【分析对象：儿童（3-12岁）】
特别注意：
- 生长发育期的儿童对添加剂更敏感
- 某些人工色素（如柠檬黄、日落黄）可能影响注意力
- 过量糖分影响牙齿健康和饮食习惯
- 防腐剂如苯甲酸钠儿童应尽量避免
- 请标注对儿童"危险"或"不适合"的配料`,
    
    pregnant: `【分析对象：孕妇】
特别注意：
- 孕期饮食直接影响胎儿健康
- 人工甜味剂（如阿斯巴甜）孕妇应避免
- 部分防腐剂和色素可能影响胎儿发育
- 过量咖啡因需严格控制
- 反式脂肪对孕妇和胎儿都有害
- 请标注对孕妇"危险"或"需避免"的配料`,
    
    adult: `【分析对象：成年人】
特别注意：
- 成年人代谢能力较强，部分添加剂适量可接受
- 关注长期健康影响，标注"风险"而非"危险"
- 控制摄入量是关键，适量消费通常安全
- 重点标注需要"控制摄入量"的配料`
  }
  return prompts[identity] || prompts.adult
}

/**
 * 调用 LLM 多模态 API 进行配料分析
 * 注意：需要在云函数环境变量中配置 LLM_API_KEY
 */
async function callLLMAnalysis(imageUrl, identity) {
  const identityPrompt = getIdentityPrompt(identity)
  
  const systemPrompt = `你是一位专业的食品安全和营养专家，专门分析食品配料表的健康风险。
请根据图片中的配料表内容，为${identity === 'child' ? '儿童' : identity === 'pregnant' ? '孕妇' : '成年人'}提供专业的配料分析。

${identityPrompt}

请严格按以下 JSON 格式返回分析结果：
{
  "productName": "产品名称（从配料表推断）",
  "healthScore": 0-100的整数健康评分,
  "recommendation": "推荐"或"不推荐"或"谨慎食用",
  "recommendationReason": "推荐/不推荐的具体原因（50字以内）",
  "ingredients": [
    {
      "name": "配料名称",
      "category": "主要原料"或"添加剂"或"调味料"或"防腐剂"或"色素"或"甜味剂"或"其他",
      "riskLevel": "安全"或"警告"或"危险",
      "description": "该配料的简要说明（30字以内）",
      "suggestion": "针对当前人群的建议（30字以内）"
    }
  ],
  "healthTips": "针对该产品的健康建议（100字以内）"
}

评分标准：
- 90-100：配料天然健康，无有害添加剂
- 70-89：配料基本健康，有少量可接受添加剂
- 50-69：含有需要注意的添加剂
- 30-49：含有较多不健康配料或添加剂
- 0-29：含有大量有害添加剂，不建议食用`

  const userPrompt = `请分析这张食品配料表图片，给出详细的配料分析报告。
图片地址：${imageUrl}

请返回符合上述 JSON 格式的分析结果。`

  try {
    // 调用 LLM API（需要配置 API Key）
    // 这里使用豆包 API 示例，实际部署时替换为你的 API 配置
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LLM_API_KEY || ''}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: userPrompt }
          ]}
        ],
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`LLM API 错误: ${response.status}`)
    }

    const result = await response.json()
    const content = result.choices[0].message.content
    
    // 解析 JSON 结果
    // 处理可能的 markdown 代码块包裹
    let jsonStr = content
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonStr
    }
    
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('LLM 分析失败:', error)
    // 返回默认结构，避免前端报错
    return {
      productName: '未知产品',
      healthScore: 50,
      recommendation: '谨慎食用',
      recommendationReason: '分析服务暂时不可用',
      ingredients: [],
      healthTips: '请稍后重试或手动查看配料表'
    }
  }
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { imageUrl, identity = 'adult', imageKey } = event
  const wxContext = cloud.getWXContext()

  console.log('分析请求:', { imageUrl, identity, imageKey, openid: wxContext.OPENID })

  try {
    // 1. 调用 LLM 分析
    const analysis = await callLLMAnalysis(imageUrl, identity)
    
    // 2. 生成缓存 hash
    const contentHash = generateContentHash(analysis.ingredients, identity)
    
    // 3. 检查缓存是否已有相同配料+身份的分析
    const cached = await getFromCache(contentHash)
    
    if (cached) {
      return {
        code: 200,
        msg: 'success',
        data: {
          ...cached.data,
          cached: true
        }
      }
    }

    // 4. 构建保存数据
    const recordData = {
      openid: wxContext.OPENID,        // 用户标识
      imageKey: imageKey || '',         // 云存储文件 ID
      imageUrl: imageUrl,               // 图片 URL
      identity: identity,               // 人群身份
      productName: analysis.productName,
      healthScore: analysis.healthScore,
      recommendation: analysis.recommendation,
      recommendationReason: analysis.recommendationReason,
      ingredients: analysis.ingredients,
      healthTips: analysis.healthTips,
      contentHash: contentHash,         // 缓存 hash
      createTime: db.serverDate(),      // 服务端时间
      updateTime: db.serverDate()
    }

    // 5. 保存到数据库
    const saveResult = await db.collection('scan_history').add({ data: recordData })
    
    // 6. 写入内存缓存
    memoryCache.set(contentHash, {
      data: { ...recordData, _id: saveResult._id },
      timestamp: Date.now()
    })

    // 7. 返回结果
    return {
      code: 200,
      msg: 'success',
      data: {
        _id: saveResult._id,
        ...recordData,
        cached: false
      }
    }
  } catch (error) {
    console.error('分析失败:', error)
    return {
      code: 500,
      msg: error.message || '分析失败，请重试',
      data: null
    }
  }
}