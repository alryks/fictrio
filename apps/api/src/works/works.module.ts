import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgressModule } from '../progress/progress.module';
import { WorksCacheService } from './works-cache.service';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  imports: [AuthModule, PrismaModule, ProgressModule],
  controllers: [WorksController],
  providers: [WorksService, WorksCacheService],
  exports: [WorksCacheService],
})
export class WorksModule {}
