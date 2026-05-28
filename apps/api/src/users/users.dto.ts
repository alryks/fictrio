import {
  updateMyProfileInputSchema,
  type UpdateMyProfileInput,
} from '@fictrio/contracts';

export class UpdateMyProfileDto implements UpdateMyProfileInput {
  static readonly schema = updateMyProfileInputSchema;

  username?: string;
  displayName?: string;
  bio?: string | null;
}
