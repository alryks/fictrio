import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import {
  CreateCommentDto,
  CreateReviewDto,
  GetPostsPageQueryDto,
  ModeratePostDto,
  UpdateCommentDto,
  UpdateReviewDto,
} from './posts.dto';
import { PostsService } from './posts.service';

@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('works/:workId/reviews')
  @UseGuards(OptionalJwtAuthGuard)
  getWorkReviews(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetPostsPageQueryDto,
  ) {
    return this.postsService.getWorkReviews(workId, query, user);
  }

  @Post('works/:workId/reviews')
  @UseGuards(JwtAuthGuard)
  createWorkReview(
    @Param('workId', ParseUUIDPipe) workId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.postsService.createWorkReview(workId, user.id, dto);
  }

  @Patch('reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  updateReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.postsService.updateReview(reviewId, user.id, dto);
  }

  @Delete('reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  deleteReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.deleteReview(reviewId, user.id);
  }

  @Post('reviews/:reviewId/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MODERATION_ROLES)
  moderateReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModeratePostDto,
  ) {
    return this.postsService.moderatePost(reviewId, user, dto, 'review');
  }

  @Get('reviews/:reviewId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  getReviewComments(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: GetPostsPageQueryDto,
  ) {
    return this.postsService.getReviewComments(reviewId, query, user);
  }

  @Post('reviews/:reviewId/comments')
  @UseGuards(JwtAuthGuard)
  createReviewComment(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.createReviewComment(reviewId, user.id, dto);
  }

  @Patch('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  updateComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.postsService.updateComment(commentId, user.id, dto);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  deleteComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.deleteComment(commentId, user.id);
  }

  @Post('comments/:commentId/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MODERATION_ROLES)
  moderateComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModeratePostDto,
  ) {
    return this.postsService.moderatePost(commentId, user, dto, 'comment');
  }
}
