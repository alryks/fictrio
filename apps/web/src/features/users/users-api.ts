import type {
  PublicUser,
  PublicUserProfile,
  UpdateMyProfileInput,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type { PublicUserProfile, UpdateMyProfileInput };

export function getUserProfile(username: string) {
  return apiRequest<PublicUserProfile>(
    `/users/${encodeURIComponent(username)}`,
  );
}

export function updateMyProfile(input: UpdateMyProfileInput) {
  return apiRequest<PublicUser>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
