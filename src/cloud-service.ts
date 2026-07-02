/**
 * 微信云开发服务封装
 * 用于在 Taro 小程序中调用云函数
 */

import Taro from '@tarojs/taro'

/**
 * 云开发初始化（在小程序启动时调用）
 */
export function initCloud() {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
    try {
      Taro.cloud.init({
        env: 'your-env-id', // 替换为你的云开发环境 ID
        traceUser: true
      })
      console.log('云开发初始化成功')
    } catch (e) {
      console.error('云开发初始化失败:', e)
    }
  }
}

/**
 * 调用云函数
 * @param name 云函数名称
 * @param data 传递给云函数的数据
 */
export async function callCloudFunction(name: string, data: Record<string, unknown> = {}) {
  console.log(`调用云函数 ${name}:`, data)
  
  try {
    const res = await Taro.cloud.callFunction({
      name,
      data
    })
    
    console.log(`云函数 ${name} 返回:`, res.result)
    
    // 云函数返回结构: { code, msg, data }
    if (res.result && typeof res.result === 'object') {
      if (res.result.code === 200) {
        return res.result.data
      } else {
        throw new Error(res.result.msg || '云函数调用失败')
      }
    }
    
    return res.result
  } catch (error) {
    console.error(`云函数 ${name} 调用失败:`, error)
    throw error
  }
}

/**
 * 上传文件到云存储
 * @param filePath 本地文件路径（临时路径）
 * @param cloudPath 云存储路径（可选，不传则自动生成）
 */
export async function uploadToCloudStorage(filePath: string, cloudPath?: string) {
  console.log('上传到云存储:', filePath)
  
  try {
    // 生成云存储路径
    const path = cloudPath || `ingredients/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    
    const res = await Taro.cloud.uploadFile({
      cloudPath: path,
      filePath
    })
    
    console.log('上传成功:', res.fileID)
    
    // 获取临时访问 URL
    const urlRes = await Taro.cloud.getTempFileURL({
      fileList: [res.fileID]
    })
    
    const imageUrl = urlRes.fileList[0].tempFileURL
    
    return {
      fileID: res.fileID,    // 云存储文件 ID
      imageUrl: imageUrl     // 可访问的 URL
    }
  } catch (error) {
    console.error('上传失败:', error)
    throw error
  }
}

/**
 * 删除云存储文件
 * @param fileID 云存储文件 ID
 */
export async function deleteFromCloudStorage(fileID: string) {
  try {
    await Taro.cloud.deleteFile({
      fileList: [fileID]
    })
    console.log('删除云存储文件成功:', fileID)
  } catch (error) {
    console.error('删除失败:', error)
    throw error
  }
}

/**
 * 云函数服务类（替代原来的 Network.request）
 */
export const CloudService = {
  // 配料分析
  analyze: async (imageUrl: string, identity: string, imageKey?: string) => {
    return callCloudFunction('analyze', { imageUrl, identity, imageKey })
  },
  
  // 获取历史记录列表
  getHistory: async (identity?: string, page = 1, pageSize = 20) => {
    return callCloudFunction('history', { identity, page, pageSize })
  },
  
  // 获取历史详情
  getHistoryDetail: async (id: string) => {
    return callCloudFunction('historyDetail', { id })
  },
  
  // 删除历史记录
  deleteHistory: async (id: string) => {
    return callCloudFunction('deleteHistory', { id })
  },
  
  // 上传图片
  uploadImage: async (filePath: string) => {
    return uploadToCloudStorage(filePath)
  }
}

// 导出初始化函数和服务类
export default CloudService