import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GetWorksQueryDto } from './works.dto';
import { WorksService } from './works.service';

@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  findMany(@Query() query: GetWorksQueryDto) {
    return this.worksService.findMany(query);
  }

  @Get(':workId')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.worksService.findOne(workId, user?.id);
  }
}
