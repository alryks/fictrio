import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GetProgressQueryDto, UpsertWorkProgressDto } from './progress.dto';
import { ProgressService } from './progress.service';

@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('users/:username/progress/summary')
  findUserProgressSummary(@Param('username') username: string) {
    return this.progressService.findUserProgressSummary(username);
  }

  @Get('users/:username/progress')
  findUserProgress(
    @Param('username') username: string,
    @Query() query: GetProgressQueryDto,
  ) {
    return this.progressService.findUserProgress(username, query);
  }

  @Put('works/:workId/progress')
  @UseGuards(JwtAuthGuard)
  upsertWorkProgress(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertWorkProgressDto,
  ) {
    return this.progressService.upsertWorkProgress(workId, user.id, dto);
  }

  @Delete('works/:workId/progress')
  @UseGuards(JwtAuthGuard)
  deleteWorkProgress(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.deleteWorkProgress(workId, user.id);
  }
}
