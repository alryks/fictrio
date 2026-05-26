import type {
  AuthResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type AuthUser = PublicUser;
export type LoginPayload = LoginInput;
export type RegisterPayload = RegisterInput;

export function login(payload: LoginPayload) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterPayload) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(token: string) {
  return apiRequest<AuthUser>("/auth/me", {
    token,
  });
}
