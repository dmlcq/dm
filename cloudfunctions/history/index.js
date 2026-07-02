/**
 * 历史记录列表云函数
 * 功能：获取用户的配料分析历史记录
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { identity, page = 1, pageSize = 20 } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('获取历史记录:', { openid, identity, page, pageSize })

  try {
    // 构建查询条件
    let query = db.collection('scan_history').where({ openid })
    
    // 如果指定了身份，按身份筛选
    if (identity && identity !== 'all') {
      query = query.where({ identity })
    }

    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    // 获取总数
    const countResult = await db.collection('scan_history')
      .where(identity && identity !== 'all' ? { openid, identity } : { openid })
      .count()

    // 格式化返回数据
    const list = result.data.map(item => ({
      _id: item._id,
      imageUrl: item.imageUrl,
      productName: item.productName,
      healthScore: item.healthScore,
      recommendation: item.recommendation,
      identity: item.identity,
      createTime: item.createTime,
      // 统计配料风险
      safeCount: item.ingredients?.filter(i => i.riskLevel === '安全').length || 0,
      warningCount: item.ingredients?.filter(i => i.riskLevel === '警告').length || 0,
      dangerCount: item.ingredients?.filter(i => i.riskLevel === '危险').length || 0
    }))

    return {
      code: 200,
      msg: 'success',
      data: {
        list,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + pageSize < countResult.total
      }
    }
  } catch (error) {
    console.error('获取历史记录失败:', error)
    return {
      code: 500,
      msg: error.message || '获取历史记录失败',
      data: null
    }
  }
}