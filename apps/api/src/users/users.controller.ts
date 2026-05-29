import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  GetFollowListQueryDto,
  GetUsersQueryDto,
  UpdateMyProfileDto,
} from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  searchUsers(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetUsersQueryDto,
  ) {
    return this.usersService.searchUsers(query, user?.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  findPublicProfile(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.usersService.findPublicProfile(username, user?.id);
  }

  @Get(':username/followers')
  @UseGuards(OptionalJwtAuthGuard)
  getFollowers(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetFollowListQueryDto,
  ) {
    return this.usersService.getFollowers(username, query, user?.id);
  }

  @Get(':username/following')
  @UseGuards(OptionalJwtAuthGuard)
  getFollowing(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetFollowListQueryDto,
  ) {
    return this.usersService.getFollowing(username, query, user?.id);
  }

  @Post(':username/follow')
  @UseGuards(JwtAuthGuard)
  follow(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.follow(username, user.id);
  }

  @Delete(':username/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.unfollow(username, user.id);
  }
}
