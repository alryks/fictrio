import type {
  FollowResponse,
  ManageableRole,
  PublicUserProfile,
  SelfUser,
  UpdateMyProfileInput,
  UserSummary,
  UsersPage,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type {
  ManageableRole,
  PublicUserProfile,
  UpdateMyProfileInput,
  UserSummary,
  UsersPage,
};

export function getUserProfile(username: string) {
  return apiRequest<PublicUserProfile>(
    `/users/${encodeURIComponent(username)}`,
  );
}

export function updateMyProfile(input: UpdateMyProfileInput) {
  return apiRequest<SelfUser>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

function buildUsersQuery(search: string, offset: number, limit: number) {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  return params.toString();
}

export function searchUsers(search: string, offset = 0, limit = 20) {
  return apiRequest<UsersPage>(`/users?${buildUsersQuery(search, offset, limit)}`);
}

export function getFollowers(
  username: string,
  search: string,
  offset = 0,
  limit = 20,
) {
  return apiRequest<UsersPage>(
    `/users/${encodeURIComponent(username)}/followers?${buildUsersQuery(search, offset, limit)}`,
  );
}

export function getFollowing(
  username: string,
  search: string,
  offset = 0,
  limit = 20,
) {
  return apiRequest<UsersPage>(
    `/users/${encodeURIComponent(username)}/following?${buildUsersQuery(search, offset, limit)}`,
  );
}

export function followUser(username: string) {
  return apiRequest<FollowResponse>(
    `/users/${encodeURIComponent(username)}/follow`,
    { method: "POST" },
  );
}

export function unfollowUser(username: string) {
  return apiRequest<FollowResponse>(
    `/users/${encodeURIComponent(username)}/follow`,
    { method: "DELETE" },
  );
}

export function setUserActive(username: string, isActive: boolean) {
  return apiRequest<PublicUserProfile>(
    `/users/${encodeURIComponent(username)}/active`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  );
}

export function assignUserRole(username: string, role: ManageableRole) {
  return apiRequest<PublicUserProfile>(
    `/users/${encodeURIComponent(username)}/roles/${role}`,
    { method: "PUT" },
  );
}

export function removeUserRole(username: string, role: ManageableRole) {
  return apiRequest<PublicUserProfile>(
    `/users/${encodeURIComponent(username)}/roles/${role}`,
    { method: "DELETE" },
  );
}
