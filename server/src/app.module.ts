import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { IngredientsModule } from '@/modules/ingredients/ingredients.module';

@Module({
  imports: [IngredientsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
