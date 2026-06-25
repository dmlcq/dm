import { Controller, Post, Get, Delete, UploadedFile, UseInterceptors, Body, Param, Query, HttpCode } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IngredientsService, AnalysisResult, ScanHistoryRecord } from './ingredients.service'

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  // 上传配料表图片
  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    console.log('上传文件信息:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size
    })

    if (!file || !file.buffer) {
      return { code: 400, msg: '未收到有效图片文件', data: null }
    }

    const result = await this.ingredientsService.uploadImage(file)
    return { code: 200, msg: 'success', data: result }
  }

  // 分析配料表（带缓存）
  @Post('analyze')
  @HttpCode(200)
  async analyzeIngredients(@Body() body: { imageKey: string }): Promise<{ code: number; msg: string; data: (AnalysisResult & { cached?: boolean }) | null }> {
    console.log('分析请求:', body)

    if (!body.imageKey) {
      return { code: 400, msg: '缺少图片Key', data: null }
    }

    const result = await this.ingredientsService.analyzeIngredients(body.imageKey)
    console.log('分析结果:', { score: result.score, cached: result.cached })
    return { code: 200, msg: 'success', data: result }
  }

  // 获取历史记录列表
  @Get('history')
  async getHistory(@Query('limit') limit?: string): Promise<{ code: number; msg: string; data: ScanHistoryRecord[] }> {
    const limitNum = limit ? parseInt(limit, 10) : 20
    const history = await this.ingredientsService.getHistory(limitNum)
    console.log('获取历史记录:', { count: history.length })
    return { code: 200, msg: 'success', data: history }
  }

  // 获取单条历史记录详情
  @Get('history/:id')
  async getHistoryDetail(@Param('id') id: string): Promise<{ code: number; msg: string; data: ScanHistoryRecord | null }> {
    console.log('获取历史详情:', id)
    const detail = await this.ingredientsService.getHistoryDetail(id)
    if (!detail) {
      return { code: 404, msg: '记录不存在', data: null }
    }
    return { code: 200, msg: 'success', data: detail }
  }

  // 删除历史记录
  @Delete('history/:id')
  @HttpCode(200)
  async deleteHistory(@Param('id') id: string): Promise<{ code: number; msg: string }> {
    console.log('删除历史记录:', id)
    await this.ingredientsService.deleteHistory(id)
    return { code: 200, msg: '删除成功' }
  }
}