/**
 * 历史记录详情云函数
 * 功能：获取单条分析记录的详细信息
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { id } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('获取详情:', { id, openid })

  try {
    const result = await db.collection('scan_history')
      .where({
        _id: id,
        openid  // 确保只能查看自己的记录
      })
      .get()

    if (result.data.length === 0) {
      return {
        code: 404,
        msg: '记录不存在',
        data: null
      }
    }

    return {
      code: 200,
      msg: 'success',
      data: result.data[0]
    }
  } catch (error) {
    console.error('获取详情失败:', error)
    return {
      code: 500,
      msg: error.message || '获取详情失败',
      data: null
    }
  }
}