import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Leaf, Triangle, Octagon, Trash2, ArrowLeft, Clock } from 'lucide-react-taro'

// 历史记录类型
interface HistoryRecord {
  id: string
  image_key: string
  image_url: string
  product_name?: string
  health_score: number
  recommendation: 'recommend' | 'caution' | 'avoid'
  ingredients: Array<{
    name: string
    riskLevel: 'safe' | 'warning' | 'danger'
    description: string
    alternatives?: string
  }>
  created_at: string
}

const HistoryPage = () => {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryRecord[]>([])

  // 获取历史记录
  const fetchHistory = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/ingredients/history',
        method: 'GET'
      })
      
      console.log('历史记录响应:', res.data)
      
      const data = res.data?.data || res.data || []
      setHistory(data as HistoryRecord[])
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

  // 删除记录
  const handleDelete = async (id: string) => {
    try {
      const res = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这条分析记录吗？'
      })
      
      if (res.confirm) {
        await Network.request({
          url: `/api/ingredients/history/${id}`,
          method: 'DELETE'
        })
        
        Taro.showToast({ title: '删除成功', icon: 'success' })
        fetchHistory()
      }
    } catch (error) {
      console.error('删除失败:', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  // 查看详情
  const handleViewDetail = (record: HistoryRecord) => {
    // 跳转回首页并显示详情（通过全局状态或URL参数）
    Taro.navigateTo({
      url: `/pages/index/index?historyId=${record.id}`
    })
  }

  // 获取推荐样式
  const getRecommendationBadge = (rec: 'recommend' | 'caution' | 'avoid') => {
    switch (rec) {
      case 'recommend':
        return { text: '推荐', className: 'bg-green-500 text-white' }
      case 'caution':
        return { text: '谨慎', className: 'bg-orange-500 text-white' }
      case 'avoid':
        return { text: '不推荐', className: 'bg-red-500 text-white' }
    }
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 计算风险统计
  const getRiskStats = (ingredients: HistoryRecord['ingredients']) => {
    const safe = ingredients.filter(i => i.riskLevel === 'safe').length
    const warning = ingredients.filter(i => i.riskLevel === 'warning').length
    const danger = ingredients.filter(i => i.riskLevel === 'danger').length
    return { safe, warning, danger }
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
            
            return (
              <Card key={record.id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex flex-row gap-3">
                    {/* 图片预览 */}
                    <View className="flex-shrink-0">
                      <Image 
                        src={record.image_url}
                        className="w-16 h-16 rounded-lg object-cover"
                        mode="aspectFill"
                      />
                    </View>
                    
                    {/* 信息区 */}
                    <View className="flex-1 min-w-0">
                      <View className="flex flex-row items-center justify-between mb-1">
                        <View className="flex flex-row items-center">
                          <Text className="block text-lg font-bold text-gray-800">
                            {record.health_score}分
                          </Text>
                          <Badge className={`${badgeInfo.className} ml-2`}>
                            <Text className="text-xs">{badgeInfo.text}</Text>
                          </Badge>
                        </View>
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
                        {formatDate(record.created_at)}
                      </Text>
                    </View>
                    
                    {/* 操作按钮 */}
                    <View className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDetail(record)}
                      >
                        <Text className="text-green-600 text-xs">详情</Text>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )
          })}
          
          {/* 加载更多 */}
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