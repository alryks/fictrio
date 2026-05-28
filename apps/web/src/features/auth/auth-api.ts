import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  SelfUser,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type AuthUser = SelfUser;
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

export function logout() {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function getMe() {
  return apiRequest<AuthUser>("/auth/me");
}
