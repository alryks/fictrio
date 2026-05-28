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

export const registerInputSchema = z.object({
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
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  bio: z.string().nullable(),
  isActive: z.boolean(),
  roles: z.array(z.string()),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/**
 * Response returned from /auth/login and /auth/register. The JWT itself
 * is delivered to the browser as an HttpOnly cookie set by the server,
 * and the body only mirrors the public user profile so the UI can
 * populate its session state.
 */
export const authResponseSchema = z.object({
  user: publicUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const csrfTokenResponseSchema = z.object({
  csrfToken: z.string(),
});
export type CsrfTokenResponse = z.infer<typeof csrfTokenResponseSchema>;
