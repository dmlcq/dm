import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Camera, ImageUp, Leaf, Triangle, Octagon, RefreshCw } from 'lucide-react-taro'

// 配料分析结果类型
interface Ingredient {
  name: string
  riskLevel: 'safe' | 'warning' | 'danger'
  description: string
  alternatives?: string
}

interface AnalysisResult {
  score: number
  recommendation: 'recommend' | 'caution' | 'avoid'
  ingredients: Ingredient[]
  summary: string
}

const IndexPage = () => {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [localImagePath, setLocalImagePath] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  // 选择图片（拍照或相册）
  const handleChooseImage = async (sourceType: 'camera' | 'album') => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: [sourceType]
      })
      
      const tempFilePath = res.tempFilePaths[0]
      setLocalImagePath(tempFilePath)
      setImageUrl(tempFilePath)
      setResult(null)
      
      // 自动上传并分析
      await uploadAndAnalyze(tempFilePath)
    } catch (error) {
      console.error('选择图片失败:', error)
      Taro.showToast({ title: '选择图片失败', icon: 'none' })
    }
  }

  // 上传图片并分析
  const uploadAndAnalyze = async (filePath: string) => {
    setLoading(true)
    try {
      // 1. 上传图片
      const uploadRes = await Network.uploadFile({
        url: '/api/ingredients/upload',
        filePath,
        name: 'file'
      })
      
      console.log('上传响应:', uploadRes.data)
      
      // 解析上传响应
      const uploadData = typeof uploadRes.data === 'string' 
        ? JSON.parse(uploadRes.data) 
        : uploadRes.data
      
      const imageKey = uploadData.data?.imageKey
      const uploadedUrl = uploadData.data?.imageUrl
      
      if (!imageKey) {
        throw new Error('上传失败，未获取图片Key')
      }
      
      // 使用返回的 URL 更新预览
      if (uploadedUrl) {
        setImageUrl(uploadedUrl)
      }
      
      // 2. 调用分析接口
      Taro.showToast({ title: '正在分析配料...', icon: 'loading', duration: 30000 })
      
      const analyzeRes = await Network.request({
        url: '/api/ingredients/analyze',
        method: 'POST',
        data: { imageKey }
      })
      
      console.log('分析响应:', analyzeRes.data)
      
      // 解析分析响应
      const analyzeData = analyzeRes.data?.data || analyzeRes.data
      setResult(analyzeData)
      
      Taro.hideToast()
      Taro.showToast({ title: '分析完成', icon: 'success' })
      
    } catch (error) {
      console.error('分析失败:', error)
      Taro.hideToast()
      Taro.showToast({ title: '分析失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 重新分析
  const handleReanalyze = () => {
    if (localImagePath) {
      uploadAndAnalyze(localImagePath)
    }
  }

  // 获取风险等级样式
  const getRiskBadge = (level: 'safe' | 'warning' | 'danger') => {
    switch (level) {
      case 'safe':
        return { variant: 'default', className: 'bg-green-500 text-white', icon: Leaf }
      case 'warning':
        return { variant: 'secondary', className: 'bg-orange-500 text-white', icon: Triangle }
      case 'danger':
        return { variant: 'destructive', className: 'bg-red-500 text-white', icon: Octagon }
    }
  }

  // 获取推荐建议样式
  const getRecommendationStyle = (rec: 'recommend' | 'caution' | 'avoid') => {
    switch (rec) {
      case 'recommend':
        return { text: '推荐购买', className: 'text-green-600', bgColor: 'bg-green-50' }
      case 'caution':
        return { text: '谨慎购买', className: 'text-orange-600', bgColor: 'bg-orange-50' }
      case 'avoid':
        return { text: '不建议购买', className: 'text-red-600', bgColor: 'bg-red-50' }
    }
  }

  // 渲染配料卡片
  const renderIngredientCard = (ingredient: Ingredient, index: number) => {
    const badgeInfo = getRiskBadge(ingredient.riskLevel)
    const IconComponent = badgeInfo.icon
    
    return (
      <Card key={index} className="mb-3">
        <CardHeader className="pb-2">
          <View className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{ingredient.name}</CardTitle>
            <Badge className={badgeInfo.className}>
              <IconComponent size={12} color="#ffffff" className="mr-1" />
              <Text>
                {ingredient.riskLevel === 'safe' ? '安全' : 
                 ingredient.riskLevel === 'warning' ? '注意' : '高风险'}
              </Text>
            </Badge>
          </View>
        </CardHeader>
        <CardContent>
          <Text className="block text-sm text-gray-600 mb-2">{ingredient.description}</Text>
          {ingredient.alternatives && (
            <View className="bg-green-50 rounded-lg p-2">
              <Text className="block text-xs text-green-700">
                💡 替代建议：{ingredient.alternatives}
              </Text>
            </View>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="min-h-screen bg-green-50 p-4">
      {/* 顶部标题 */}
      <View className="text-center mb-6">
        <Leaf size={32} color="#22c55e" className="mb-2" />
        <Text className="block text-xl font-bold text-gray-800">配料表AI分析</Text>
        <Text className="block text-sm text-gray-500 mt-1">
          智能识别配料，守护健康饮食
        </Text>
      </View>

      {/* 操作入口 */}
      {!result && !loading && (
        <Card className="mb-4">
          <CardContent className="p-6">
            <View className="flex flex-col gap-4">
              <Button 
                className="bg-green-500 hover:bg-green-600 w-full"
                onClick={() => handleChooseImage('camera')}
              >
                <Camera size={20} color="#fff" className="mr-2" />
                <Text className="text-white font-medium">拍照识别</Text>
              </Button>
              <Button 
                variant="outline"
                className="w-full border-green-500 text-green-600"
                onClick={() => handleChooseImage('album')}
              >
                <ImageUp size={20} color="#22c55e" className="mr-2" />
                <Text className="font-medium">从相册选择</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 图片预览 */}
      {imageUrl && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-2">
              <Text className="block text-sm font-medium text-gray-700">配料表图片</Text>
              {!loading && (
                <Button variant="ghost" size="sm" onClick={handleReanalyze}>
                  <RefreshCw size={16} color="#6b7280" className="mr-1" />
                  <Text className="text-gray-500 text-xs">重新分析</Text>
                </Button>
              )}
            </View>
            <View className="relative rounded-lg overflow-hidden">
              <Image 
                src={imageUrl} 
                className="w-full h-40 object-cover"
                mode="aspectFit"
              />
            </View>
          </CardContent>
        </Card>
      )}

      {/* 加载态 */}
      {loading && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </View>
            <Text className="block text-center text-sm text-gray-500 mt-4">
              AI正在分析配料...
            </Text>
          </CardContent>
        </Card>
      )}

      {/* 分析结果 */}
      {result && !loading && (
        <View>
          {/* 健康评分卡片 */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg text-center">健康评分</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex flex-col items-center">
                <View className="relative w-24 h-24 mb-4">
                  <Progress 
                    value={result.score} 
                    className="w-24 h-24 rounded-full"
                  />
                  <View className="absolute inset-0 flex items-center justify-center">
                    <Text className="block text-3xl font-bold text-green-600">
                      {result.score}
                    </Text>
                  </View>
                </View>
                
                {/* 推荐建议 */}
                <View className={`w-full rounded-lg p-3 ${getRecommendationStyle(result.recommendation).bgColor}`}>
                  <Text className={`block text-center font-bold text-lg ${getRecommendationStyle(result.recommendation).className}`}>
                    {getRecommendationStyle(result.recommendation).text}
                  </Text>
                  <Text className="block text-center text-sm text-gray-600 mt-1">
                    {result.summary}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          <Separator className="my-4" />

          {/* 配料列表 */}
          <View className="mb-2">
            <Text className="block text-lg font-bold text-gray-800">
              配料详情 ({result.ingredients.length}项)
            </Text>
          </View>
          
          {result.ingredients.map((ingredient, index) => 
            renderIngredientCard(ingredient, index)
          )}
        </View>
      )}
    </View>
  )
}

export default IndexPage