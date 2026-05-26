import {
  loginInputSchema,
  registerInputSchema,
  type LoginInput,
  type RegisterInput,
} from '@fictrio/contracts';

export class RegisterDto implements RegisterInput {
  static readonly schema = registerInputSchema;

  username!: string;
  email!: string;
  password!: string;
  displayName?: string;
}

export class LoginDto implements LoginInput {
  static readonly schema = loginInputSchema;

  username!: string;
  password!: string;
}
