import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_ROLES } from '../auth/roles';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GetWorksQueryDto, UpdateWorkDto } from './works.dto';
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

  @Patch(':workId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  updateWork(
    @Param('workId', ParseUUIDPipe) workId: string,
    @Body() dto: UpdateWorkDto,
  ) {
    return this.worksService.updateWork(workId, dto);
  }

  @Delete(':workId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  deleteWork(@Param('workId', ParseUUIDPipe) workId: string) {
    return this.worksService.deleteWork(workId);
  }
}
