/**
 * 删除历史记录云函数
 * 功能：删除指定的分析记录
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { id } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('删除记录:', { id, openid })

  try {
    // 先验证记录归属
    const checkResult = await db.collection('scan_history')
      .where({
        _id: id,
        openid
      })
      .get()

    if (checkResult.data.length === 0) {
      return {
        code: 404,
        msg: '记录不存在或无权删除',
        data: null
      }
    }

    // 删除记录
    await db.collection('scan_history').doc(id).remove()

    // 同时删除云存储中的图片（如果有）
    const record = checkResult.data[0]
    if (record.imageKey) {
      try {
        await cloud.deleteFile({ fileList: [record.imageKey] })
        console.log('已删除云存储图片:', record.imageKey)
      } catch (e) {
        console.log('删除云存储图片失败:', e)
      }
    }

    return {
      code: 200,
      msg: '删除成功',
      data: { id }
    }
  } catch (error) {
    console.error('删除失败:', error)
    return {
      code: 500,
      msg: error.message || '删除失败',
      data: null
    }
  }
}