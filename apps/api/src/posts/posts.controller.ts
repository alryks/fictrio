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
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateCommentDto,
  CreateReviewDto,
  GetPostsPageQueryDto,
  UpdateCommentDto,
  UpdateReviewDto,
} from './posts.dto';
import { PostsService } from './posts.service';

@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('works/:workId/reviews')
  getWorkReviews(
    @Param('workId', ParseUUIDPipe) workId: string,
    @Query() query: GetPostsPageQueryDto,
  ) {
    return this.postsService.getWorkReviews(workId, query);
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

  @Get('reviews/:reviewId/comments')
  getReviewComments(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Query() query: GetPostsPageQueryDto,
  ) {
    return this.postsService.getReviewComments(reviewId, query);
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
}
