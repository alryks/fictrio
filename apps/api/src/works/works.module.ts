import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorksController],
  providers: [WorksService],
})
export class WorksModule {}
