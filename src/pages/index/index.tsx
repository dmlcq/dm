import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import CloudService from '@/cloud-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Camera, ImageUp, Leaf, Triangle, Octagon, RefreshCw, History, User, Heart, Baby } from 'lucide-react-taro'

// 人群身份类型
type IdentityType = 'adult' | 'pregnant' | 'child'

// 配料分析结果类型（适配云函数返回格式）
interface Ingredient {
  name: string
  category?: string
  riskLevel: '安全' | '警告' | '危险'
  description: string
  suggestion?: string
}

interface AnalysisResult {
  _id?: string
  productName: string
  healthScore: number
  recommendation: '推荐' | '谨慎食用' | '不推荐'
  recommendationReason: string
  ingredients: Ingredient[]
  healthTips: string
  identity: IdentityType
  cached?: boolean
}

const IndexPage = () => {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [localImagePath, setLocalImagePath] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [identity, setIdentity] = useState<IdentityType>('adult')
  
  // 检测是否在微信小程序环境
  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  // 身份选项配置
  const identityOptions: { value: IdentityType; label: string; icon: typeof User; desc: string }[] = [
    { value: 'adult', label: '成人', icon: User, desc: '适量添加剂可接受' },
    { value: 'pregnant', label: '孕妇', icon: Heart, desc: '严格谨慎，避免风险' },
    { value: 'child', label: '儿童', icon: Baby, desc: '成长保护，限制添加剂' }
  ]

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

  // 上传图片并分析（使用云开发）
  const uploadAndAnalyze = async (filePath: string) => {
    setLoading(true)
    try {
      // 显示身份信息
      const identityLabel = identity === 'adult' ? '成人' : identity === 'pregnant' ? '孕妇' : '儿童'
      Taro.showToast({ title: `正在分析（${identityLabel}标准）...`, icon: 'loading', duration: 30000 })
      
      // 1. 上传图片到云存储
      const uploadResult = await CloudService.uploadImage(filePath)
      setImageUrl(uploadResult.imageUrl)
      
      console.log('上传成功:', uploadResult)
      
      // 2. 调用云函数分析
      const analyzeResult = await CloudService.analyze(uploadResult.imageUrl, identity, uploadResult.fileID)
      
      console.log('分析结果:', analyzeResult)
      
      // 处理结果格式（适配云函数返回）
      if (analyzeResult) {
        // 转换风险等级格式
        const processedResult = {
          ...analyzeResult,
          ingredients: analyzeResult.ingredients?.map(ing => ({
            ...ing,
            riskLevel: ing.riskLevel === '安全' ? '安全' : 
                       ing.riskLevel === '警告' ? '警告' : '危险'
          })) || []
        }
        setResult(processedResult)
      }
      
      Taro.hideToast()
      
      if (analyzeResult?.cached) {
        Taro.showToast({ title: '已从缓存获取', icon: 'success' })
      } else {
        Taro.showToast({ title: '分析完成', icon: 'success' })
      }
      
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
  const getRiskBadge = (level: '安全' | '警告' | '危险') => {
    switch (level) {
      case '安全':
        return { className: 'bg-green-500 text-white', icon: Leaf, text: '安全' }
      case '警告':
        return { className: 'bg-orange-500 text-white', icon: Triangle, text: '注意' }
      case '危险':
        return { className: 'bg-red-500 text-white', icon: Octagon, text: '高风险' }
      default:
        return { className: 'bg-gray-500 text-white', icon: Leaf, text: '未知' }
    }
  }

  // 获取推荐建议样式
  const getRecommendationStyle = (rec: '推荐' | '谨慎食用' | '不推荐') => {
    switch (rec) {
      case '推荐':
        return { text: '推荐购买', className: 'text-green-600', bgColor: 'bg-green-50' }
      case '谨慎食用':
        return { text: '谨慎购买', className: 'text-orange-600', bgColor: 'bg-orange-50' }
      case '不推荐':
        return { text: '不建议购买', className: 'text-red-600', bgColor: 'bg-red-50' }
      default:
        return { text: '待分析', className: 'text-gray-600', bgColor: 'bg-gray-50' }
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
            <View className="flex flex-row items-center">
              <CardTitle className="text-base">{ingredient.name}</CardTitle>
              {ingredient.category && (
                <Text className="text-xs text-gray-400 ml-2">({ingredient.category})</Text>
              )}
            </View>
            <Badge className={badgeInfo.className}>
              <IconComponent size={12} color="#ffffff" className="mr-1" />
              <Text>{badgeInfo.text}</Text>
            </Badge>
          </View>
        </CardHeader>
        <CardContent>
          <Text className="block text-sm text-gray-600 mb-2">{ingredient.description}</Text>
          {ingredient.suggestion && (
            <View className="bg-blue-50 rounded-lg p-2">
              <Text className="block text-xs text-blue-700">
                💡 {ingredient.suggestion}
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
      <View className="text-center mb-4">
        <Leaf size={32} color="#22c55e" className="mb-2" />
        <Text className="block text-xl font-bold text-gray-800">配料表AI分析</Text>
        <Text className="block text-sm text-gray-500 mt-1">
          智能识别配料，守护健康饮食
        </Text>
        {/* 云开发环境提示 */}
        {isWeapp && (
          <Text className="block text-xs text-green-500 mt-1">✓ 云开发模式</Text>
        )}
        {/* 历史记录入口 */}
        <View className="mt-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}
          >
            <History size={16} color="#22c55e" className="mr-1" />
            <Text className="text-green-600 text-sm">查看历史</Text>
          </Button>
        </View>
      </View>

      {/* 身份选择区域 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Text className="block text-sm font-medium text-gray-700 mb-3">选择人群身份</Text>
          <View className="flex flex-row gap-2">
            {identityOptions.map((option) => {
              const isSelected = identity === option.value
              const IconComponent = option.icon
              return (
                <View 
                  key={option.value}
                  className={`flex-1 rounded-lg p-3 border-2 transition-all ${
                    isSelected 
                      ? 'border-green-500 bg-green-100' 
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setIdentity(option.value)}
                >
                  <View className="flex flex-col items-center">
                    <IconComponent 
                      size={24} 
                      color={isSelected ? '#22c55e' : '#9ca3af'} 
                      className="mb-1"
                    />
                    <Text className={`block font-medium ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                      {option.label}
                    </Text>
                    <Text className="block text-xs text-gray-400 mt-1 text-center">
                      {option.desc}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </CardContent>
      </Card>

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
            <View className="relative rounded-lg overflow-hidden bg-gray-100">
              <Image 
                src={imageUrl} 
                className="w-full h-40"
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
              <View className="flex flex-row items-center justify-center">
                <CardTitle className="text-lg">健康评分</CardTitle>
                {result.cached && (
                  <Badge className="ml-2 bg-gray-400 text-white text-xs">缓存</Badge>
                )}
              </View>
            </CardHeader>
            <CardContent>
              <View className="flex flex-col items-center">
                <View className="relative w-32 h-32 mb-4 flex items-center justify-center">
                  <Progress 
                    value={result.healthScore} 
                    className="w-32 h-32 rounded-full"
                  />
                  <View className="absolute inset-0 flex items-center justify-center">
                    <Text className="block text-4xl font-bold text-green-600">
                      {result.healthScore}
                    </Text>
                  </View>
                </View>
                
                {/* 产品名称 */}
                {result.productName && (
                  <Text className="block text-sm text-gray-500 mb-2">
                    产品：{result.productName}
                  </Text>
                )}
                
                {/* 推荐建议 */}
                <View className={`w-full rounded-lg p-3 ${getRecommendationStyle(result.recommendation).bgColor}`}>
                  <Text className={`block text-center font-bold text-lg ${getRecommendationStyle(result.recommendation).className}`}>
                    {getRecommendationStyle(result.recommendation).text}
                  </Text>
                  <Text className="block text-center text-sm text-gray-600 mt-1">
                    {result.recommendationReason}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 健康提示 */}
          {result.healthTips && (
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <Text className="block text-sm text-blue-800">
                  💊 健康建议：{result.healthTips}
                </Text>
              </CardContent>
            </Card>
          )}

          <Separator className="my-4" />

          {/* 配料列表 */}
          <View className="mb-2">
            <Text className="block text-lg font-bold text-gray-800">
              配料详情 ({result.ingredients?.length || 0}项)
            </Text>
          </View>
          
          {result.ingredients?.map((ingredient, index) => 
            renderIngredientCard(ingredient, index)
          )}
        </View>
      )}
    </View>
  )
}

export default IndexPage