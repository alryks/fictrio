import {
  createCommentInputSchema,
  createReviewInputSchema,
  getPostsPageQuerySchema,
  updateCommentInputSchema,
  updateReviewInputSchema,
  type CreateCommentInput,
  type CreateReviewInput,
  type GetPostsPageQuery,
  type UpdateCommentInput,
  type UpdateReviewInput,
} from '@fictrio/contracts';

export class CreateReviewDto implements CreateReviewInput {
  static readonly schema = createReviewInputSchema;

  body!: string;
}

export class UpdateReviewDto implements UpdateReviewInput {
  static readonly schema = updateReviewInputSchema;

  body!: string;
}

export class CreateCommentDto implements CreateCommentInput {
  static readonly schema = createCommentInputSchema;

  body!: string;
}

export class UpdateCommentDto implements UpdateCommentInput {
  static readonly schema = updateCommentInputSchema;

  body!: string;
}

export class GetPostsPageQueryDto implements GetPostsPageQuery {
  static readonly schema = getPostsPageQuerySchema;

  limit!: number;
  offset!: number;
}
