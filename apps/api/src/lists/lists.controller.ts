import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { MODERATION_ROLES } from '../auth/roles';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpsertRatingDto } from '../ratings/ratings.dto';
import {
  AddListItemDto,
  CreateListDto,
  GetListQueryDto,
  GetListsQueryDto,
  ModerateListDto,
  ReorderListItemsDto,
  UpdateListDto,
} from './lists.dto';
import { ListsService } from './lists.service';

@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findPublic(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetListsQueryDto,
  ) {
    return this.listsService.findPublic(query, user);
  }

  @Get(':listId')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetListQueryDto,
  ) {
    return this.listsService.findOne(listId, user, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListDto) {
    return this.listsService.create(user.id, dto);
  }

  @Patch(':listId')
  @UseGuards(JwtAuthGuard)
  updateList(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateListDto,
  ) {
    return this.listsService.updateList(listId, user.id, dto);
  }

  @Delete(':listId')
  @UseGuards(JwtAuthGuard)
  deleteList(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listsService.deleteList(listId, user.id);
  }

  @Post(':listId/items')
  @UseGuards(JwtAuthGuard)
  addItem(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddListItemDto,
  ) {
    return this.listsService.addItem(listId, user.id, dto);
  }

  @Delete(':listId/items/:workId')
  @UseGuards(JwtAuthGuard)
  removeItem(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listsService.removeItem(listId, workId, user.id);
  }

  @Patch(':listId/items/order')
  @UseGuards(JwtAuthGuard)
  reorderItems(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderListItemsDto,
  ) {
    return this.listsService.reorderItems(listId, user.id, dto);
  }

  @Post(':listId/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MODERATION_ROLES)
  moderateList(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModerateListDto,
  ) {
    return this.listsService.moderateList(listId, user, dto);
  }

  @Put(':listId/rating')
  @UseGuards(JwtAuthGuard)
  rateList(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertRatingDto,
  ) {
    return this.listsService.rateList(listId, user.id, dto.value);
  }

  @Delete(':listId/rating')
  @UseGuards(JwtAuthGuard)
  deleteListRating(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listsService.deleteListRating(listId, user.id);
  }
}
