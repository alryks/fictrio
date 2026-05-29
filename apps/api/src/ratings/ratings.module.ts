import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProgressModule } from '../progress/progress.module';
import { WorksModule } from '../works/works.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [AuthModule, ProgressModule, WorksModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
