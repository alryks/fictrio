import {
  getFollowListQuerySchema,
  getUsersQuerySchema,
  setUserActiveInputSchema,
  updateMyProfileInputSchema,
  type GetFollowListQuery,
  type GetUsersQuery,
  type SetUserActiveInput,
  type UpdateMyProfileInput,
} from '@fictrio/contracts';

export class UpdateMyProfileDto implements UpdateMyProfileInput {
  static readonly schema = updateMyProfileInputSchema;

  username?: string;
  displayName?: string;
  bio?: string | null;
}

export class GetUsersQueryDto implements GetUsersQuery {
  static readonly schema = getUsersQuerySchema;

  search?: string;
  limit!: number;
  offset!: number;
}

export class GetFollowListQueryDto implements GetFollowListQuery {
  static readonly schema = getFollowListQuerySchema;

  search?: string;
  limit!: number;
  offset!: number;
}

export class SetUserActiveDto implements SetUserActiveInput {
  static readonly schema = setUserActiveInputSchema;

  isActive!: boolean;
}
