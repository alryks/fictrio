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
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpsertRatingDto } from '../ratings/ratings.dto';
import {
  AddListItemDto,
  CreateListDto,
  GetListsQueryDto,
  ReorderListItemsDto,
} from './lists.dto';
import { ListsService } from './lists.service';

@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  findPublic(@Query() query: GetListsQueryDto) {
    return this.listsService.findPublic(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.listsService.findMine(user.id);
  }

  @Get(':listId')
  findOne(@Param('listId', ParseUUIDPipe) listId: string) {
    return this.listsService.findOne(listId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListDto) {
    return this.listsService.create(user.id, dto);
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

  @Patch(':listId/items/order')
  @UseGuards(JwtAuthGuard)
  reorderItems(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderListItemsDto,
  ) {
    return this.listsService.reorderItems(listId, user.id, dto);
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
