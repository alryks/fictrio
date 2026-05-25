import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateReviewDto, UpdateReviewDto } from './posts.dto';
import { PostsService } from './posts.service';

@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('works/:workId/reviews')
  getWorkReviews(@Param('workId', ParseUUIDPipe) workId: string) {
    return this.postsService.getWorkReviews(workId);
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

  @Patch('reviews/:postId')
  @UseGuards(JwtAuthGuard)
  updateReview(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.postsService.updateReview(postId, user.id, dto);
  }

  @Delete('reviews/:postId')
  @UseGuards(JwtAuthGuard)
  deleteReview(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.deleteReview(postId, user.id);
  }
}
