import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import CloudService from '@/cloud-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Leaf, Triangle, Octagon, Trash2, ArrowLeft, Clock, User, Heart, Baby } from 'lucide-react-taro'

// 历史记录类型（适配云数据库格式）
interface HistoryRecord {
  _id: string
  imageKey: string
  imageUrl: string
  productName?: string
  healthScore: number
  recommendation: '推荐' | '谨慎食用' | '不推荐'
  ingredients: Array<{
    name: string
    category?: string
    riskLevel: '安全' | '警告' | '危险'
    description: string
    suggestion?: string
  }>
  identity?: 'adult' | 'pregnant' | 'child'
  createTime: number | string
}

const HistoryPage = () => {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryRecord[]>([])

  // 获取历史记录（使用云函数）
  const fetchHistory = async () => {
    setLoading(true)
    try {
      const data = await CloudService.getHistory()
      console.log('历史记录:', data)
      setHistory(data || [])
    } catch (error) {
      console.error('获取历史失败:', error)
      Taro.showToast({ title: '获取历史失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // 删除记录（使用云函数）
  const handleDelete = async (id: string) => {
    try {
      const res = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这条分析记录吗？'
      })
      
      if (res.confirm) {
        await CloudService.deleteHistory(id)
        Taro.showToast({ title: '删除成功', icon: 'success' })
        fetchHistory()
      }
    } catch (error) {
      console.error('删除失败:', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  // 获取推荐样式
  const getRecommendationBadge = (rec: '推荐' | '谨慎食用' | '不推荐') => {
    switch (rec) {
      case '推荐':
        return { text: '推荐', className: 'bg-green-500 text-white' }
      case '谨慎食用':
        return { text: '谨慎', className: 'bg-orange-500 text-white' }
      case '不推荐':
        return { text: '不推荐', className: 'bg-red-500 text-white' }
      default:
        return { text: '未知', className: 'bg-gray-500 text-white' }
    }
  }

  // 格式化日期
  const formatDate = (timestamp: number | string) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 计算风险统计
  const getRiskStats = (ingredients: HistoryRecord['ingredients']) => {
    const safe = ingredients?.filter(i => i.riskLevel === '安全').length || 0
    const warning = ingredients?.filter(i => i.riskLevel === '警告').length || 0
    const danger = ingredients?.filter(i => i.riskLevel === '危险').length || 0
    return { safe, warning, danger }
  }

  // 获取身份图标
  const getIdentityIcon = (identity?: 'adult' | 'pregnant' | 'child') => {
    switch (identity) {
      case 'adult':
        return { Icon: User, label: '成人', color: '#22c55e' }
      case 'pregnant':
        return { Icon: Heart, label: '孕妇', color: '#ec4899' }
      case 'child':
        return { Icon: Baby, label: '儿童', color: '#3b82f6' }
      default:
        return { Icon: User, label: '成人', color: '#22c55e' }
    }
  }

  return (
    <View className="min-h-screen bg-green-50 p-4">
      {/* 顶部导航 */}
      <View className="flex flex-row items-center mb-4">
        <Button variant="ghost" size="sm" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#22c55e" />
        </Button>
        <Text className="block text-lg font-bold text-gray-800 ml-2">分析历史</Text>
      </View>

      {/* 加载态 */}
      {loading && (
        <View>
          {[1, 2, 3].map(i => (
            <Card key={i} className="mb-3">
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 空状态 */}
      {!loading && history.length === 0 && (
        <Card className="mt-8">
          <CardContent className="p-8 text-center">
            <Clock size={48} color="#9ca3af" className="mb-4" />
            <Text className="block text-gray-500">暂无分析记录</Text>
            <Text className="block text-sm text-gray-400 mt-2">
              扫描配料表后会自动保存到历史
            </Text>
            <Button 
              className="mt-4 bg-green-500"
              onClick={() => Taro.navigateTo({ url: '/pages/index/index' })}
            >
              <Text className="text-white">开始扫描</Text>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 历史列表 */}
      {!loading && history.length > 0 && (
        <View>
          <Text className="block text-sm text-gray-500 mb-3">
            共 {history.length} 条记录
          </Text>
          
          {history.map((record) => {
            const badgeInfo = getRecommendationBadge(record.recommendation)
            const riskStats = getRiskStats(record.ingredients)
            const identityInfo = getIdentityIcon(record.identity)
            const IdentityIcon = identityInfo.Icon
            
            return (
              <Card key={record._id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex flex-row gap-3">
                    {/* 图片预览 */}
                    <View className="flex-shrink-0">
                      <Image 
                        src={record.imageUrl}
                        className="w-16 h-16 rounded-lg"
                        mode="aspectFill"
                      />
                    </View>
                    
                    {/* 信息区 */}
                    <View className="flex-1 min-w-0">
                      <View className="flex flex-row items-center justify-between mb-1">
                        <View className="flex flex-row items-center">
                          <Text className="block text-lg font-bold text-gray-800">
                            {record.healthScore}分
                          </Text>
                          <Badge className={`${badgeInfo.className} ml-2`}>
                            <Text className="text-xs">{badgeInfo.text}</Text>
                          </Badge>
                        </View>
                      </View>
                      
                      {/* 产品名称 */}
                      {record.productName && (
                        <Text className="block text-xs text-gray-600 mb-1 truncate">
                          {record.productName}
                        </Text>
                      )}
                      
                      {/* 身份标识 */}
                      <View className="flex flex-row items-center mb-1">
                        <IdentityIcon size={12} color={identityInfo.color} />
                        <Text className="text-xs text-gray-500 ml-1">{identityInfo.label}</Text>
                      </View>
                      
                      {/* 风险统计 */}
                      <View className="flex flex-row gap-2 mb-2">
                        {riskStats.safe > 0 && (
                          <View className="flex flex-row items-center">
                            <Leaf size={12} color="#22c55e" />
                            <Text className="text-xs text-green-600 ml-1">{riskStats.safe}</Text>
                          </View>
                        )}
                        {riskStats.warning > 0 && (
                          <View className="flex flex-row items-center">
                            <Triangle size={12} color="#f97316" />
                            <Text className="text-xs text-orange-600 ml-1">{riskStats.warning}</Text>
                          </View>
                        )}
                        {riskStats.danger > 0 && (
                          <View className="flex flex-row items-center">
                            <Octagon size={12} color="#ef4444" />
                            <Text className="text-xs text-red-600 ml-1">{riskStats.danger}</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* 时间 */}
                      <Text className="block text-xs text-gray-400">
                        {formatDate(record.createTime)}
                      </Text>
                    </View>
                    
                    {/* 操作按钮 */}
                    <View className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(record._id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )
          })}
          
          {/* 刷新按钮 */}
          <View className="text-center mt-4">
            <Button variant="outline" onClick={fetchHistory}>
              <Text className="text-green-600">刷新历史</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default HistoryPage