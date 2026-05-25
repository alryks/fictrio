import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpsertRatingDto } from './ratings.dto';
import { RatingsService } from './ratings.service';

@Controller('works/:workId/rating')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Put()
  upsertWorkRating(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertRatingDto,
  ) {
    return this.ratingsService.upsertWorkRating(workId, user.id, dto);
  }

  @Delete()
  deleteWorkRating(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ratingsService.deleteWorkRating(workId, user.id);
  }
}
