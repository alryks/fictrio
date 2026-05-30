import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import {
  GetFollowListQueryDto,
  GetUsersQueryDto,
  SetUserActiveDto,
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
    return this.usersService.findPublicProfile(username, user);
  }

  @Patch(':username/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  setUserActive(
    @Param('username') username: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetUserActiveDto,
  ) {
    return this.usersService.setUserActive(username, dto.isActive, user);
  }

  @Put(':username/roles/:roleCode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  assignRole(
    @Param('username') username: string,
    @Param('roleCode') roleCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.assignRole(username, roleCode, user);
  }

  @Delete(':username/roles/:roleCode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  removeRole(
    @Param('username') username: string,
    @Param('roleCode') roleCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.removeRole(username, roleCode, user);
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
