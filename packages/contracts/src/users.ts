import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Имя пользователя должно содержать не менее 3 символов")
  .max(64, "Имя пользователя должно содержать не более 64 символов")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчеркивания",
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Отображаемое имя обязательно")
  .max(64, "Отображаемое имя должно содержать не более 64 символов");

const bioSchema = z
  .string()
  .trim()
  .max(1000, "Описание должно содержать не более 1000 символов")
  .nullable()
  .optional();

export const publicUserProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  roles: z.array(z.string()),
});
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;

export const updateMyProfileInputSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: displayNameSchema.optional(),
    bio: bioSchema,
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.displayName !== undefined ||
      value.bio !== undefined,
    { message: "Передайте имя пользователя, отображаемое имя или описание" },
  );
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileInputSchema>;
