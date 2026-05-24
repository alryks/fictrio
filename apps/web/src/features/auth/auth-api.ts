import { apiRequest } from "@/lib/api";
import { AuthUser } from "./auth-store";

type AuthResponse = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUser;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  email: string;
  displayName?: string;
};

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
