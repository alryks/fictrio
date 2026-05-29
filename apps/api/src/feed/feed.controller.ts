import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GetFeedQueryDto } from './feed.dto';
import { FeedService } from './feed.service';

@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  getFollowingFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFeedQueryDto,
  ) {
    return this.feedService.getFollowingFeed(user.id, query);
  }

  @Get('users/:username/feed')
  @UseGuards(OptionalJwtAuthGuard)
  getUserFeed(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetFeedQueryDto,
  ) {
    return this.feedService.getUserFeed(username, query, user?.id);
  }
}
