import { Controller, Post, UploadedFile, UseInterceptors, Body, HttpCode } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IngredientsService, AnalysisResult } from './ingredients.service'

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

  // 分析配料表
  @Post('analyze')
  @HttpCode(200)
  async analyzeIngredients(@Body() body: { imageKey: string }): Promise<{ code: number; msg: string; data: AnalysisResult | null }> {
    console.log('分析请求:', body)

    if (!body.imageKey) {
      return { code: 400, msg: '缺少图片Key', data: null }
    }

    const result = await this.ingredientsService.analyzeIngredients(body.imageKey)
    return { code: 200, msg: 'success', data: result }
  }
}