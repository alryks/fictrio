import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Имя пользователя должно содержать не менее 3 символов')
  .max(64, 'Имя пользователя должно содержать не более 64 символов')
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    'Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчеркивания',
  );

const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать не менее 8 символов')
  .max(128, 'Пароль должен содержать не более 128 символов');

export class RegisterDto {
  static readonly schema = z.object({
    username: usernameSchema,
    email: z
      .string()
      .trim()
      .email('Некорректный адрес электронной почты')
      .max(255),
    password: passwordSchema,
    displayName: z
      .string()
      .trim()
      .min(1, 'Отображаемое имя обязательно')
      .max(64, 'Отображаемое имя должно содержать не более 64 символов')
      .optional(),
  });

  username!: string;
  email!: string;
  password!: string;
  displayName?: string;
}

export class LoginDto {
  static readonly schema = z.object({
    username: usernameSchema,
    password: passwordSchema,
  });

  username!: string;
  password!: string;
}
