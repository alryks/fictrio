import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ListsController } from './lists.controller';
import { MeListsController } from './me-lists.controller';
import { ListsService } from './lists.service';

@Module({
  imports: [AuthModule],
  controllers: [ListsController, MeListsController],
  providers: [ListsService],
})
export class ListsModule {}
