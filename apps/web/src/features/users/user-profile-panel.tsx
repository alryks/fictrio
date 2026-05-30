"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Crown,
  type LucideIcon,
  Pencil,
  Save,
  ShieldCheck,
  ShieldX,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ManageableRole,
  PublicUserProfile,
  SelfUser,
} from "@fictrio/contracts";
import { FormField } from "@/components/form-field";
import { UserBadge } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { isAdmin } from "@/lib/roles";
import { useSessionActions } from "@/features/auth/use-session";
import { FollowButton } from "./follow-button";
import { FollowListDialog } from "./follow-list-dialog";
import {
  assignUserRole,
  removeUserRole,
  setUserActive,
  updateMyProfile,
} from "./users-api";

type FieldErrors = Record<string, string>;

type UserProfilePanelProps = {
  profile: PublicUserProfile;
  viewer: SelfUser | null;
};

/** Display label and a distinct icon for each role badge. */
const roleMeta: Record<string, { label: string; Icon: LucideIcon }> = {
  user: { label: "Пользователь", Icon: User },
  moderator: { label: "Модератор", Icon: ShieldCheck },
  admin: { label: "Администратор", Icon: Crown },
};

/** Roles an administrator may grant or revoke from a profile. */
const manageableRoles: Array<{ code: ManageableRole; label: string }> = [
  { code: "moderator", label: "модератора" },
  { code: "admin", label: "администратора" },
];

export function UserProfilePanel({ profile, viewer }: UserProfilePanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { setUser } = useSessionActions();
  const isOwnProfile = viewer?.id === profile.id;
  const canAdminister = isAdmin(viewer) && !isOwnProfile;
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        username,
        displayName,
        bio: bio.trim() ? bio : null,
      }),
    onSuccess: async (updated) => {
      const updatedProfile: PublicUserProfile = {
        ...profile,
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        bio: updated.bio,
        roles: updated.roles,
      };

      setUser(updated);
      queryClient.setQueryData(
        qk.users.profile(profile.username),
        updatedProfile,
      );
      queryClient.setQueryData(
        qk.users.profile(updated.username),
        updatedProfile,
      );
      await queryClient.invalidateQueries({ queryKey: qk.lists.all });
      await queryClient.invalidateQueries({ queryKey: qk.reviews.all });

      setIsEditing(false);
      setFieldErrors({});
      toast.success("Профиль обновлен");

      if (
        profile.username !== updated.username &&
        pathname.startsWith("/users/")
      ) {
        router.replace(`/users/${updated.username}`);
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.issues.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            error.issues.map((issue) => [issue.path, issue.message]),
          ),
        );
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "Не удалось обновить профиль",
      );
    },
  });

  const applyAdminUpdate = (updated: PublicUserProfile) => {
    queryClient.setQueryData(qk.users.profile(profile.username), updated);
    return queryClient.invalidateQueries({ queryKey: qk.users.all });
  };

  const activeMutation = useMutation({
    mutationFn: () => setUserActive(profile.username, !profile.isActive),
    onSuccess: async (updated) => {
      await applyAdminUpdate(updated);
      toast.success(
        updated.isActive
          ? "Учетная запись активирована"
          : "Учетная запись деактивирована",
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось изменить статус учетной записи",
      );
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ role, grant }: { role: ManageableRole; grant: boolean }) =>
      grant
        ? assignUserRole(profile.username, role)
        : removeUserRole(profile.username, role),
    onSuccess: async (updated) => {
      await applyAdminUpdate(updated);
      toast.success("Роли обновлены");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось изменить роли",
      );
    },
  });

  const isAdminBusy = activeMutation.isPending || roleMutation.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    updateMutation.mutate();
  }

  function cancelEditing() {
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? "");
    setIsEditing(false);
    setFieldErrors({});
  }

  function startEditing() {
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? "");
    setIsEditing(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <UserBadge
                name={profile.username}
                size="md"
                tone="primary"
                className="size-16 text-lg"
              />
              <div className="min-w-0">
                <CardTitle className="truncate text-2xl">
                  {profile.displayName}
                </CardTitle>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  @{profile.username}
                </p>
                <div className="mt-2 -ml-2 flex flex-wrap items-center gap-1">
                  <FollowListDialog
                    username={profile.username}
                    mode="followers"
                    count={profile.followersCount}
                  />
                  <FollowListDialog
                    username={profile.username}
                    mode="following"
                    count={profile.followingCount}
                  />
                </div>
              </div>
            </div>
            {isOwnProfile ? (
              !isEditing ? (
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={startEditing}
                  type="button"
                >
                  <Pencil data-icon="inline-start" />
                  Изменить
                </Button>
              ) : null
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {canAdminister ? (
                  <Button
                    variant={profile.isActive ? "destructive" : "default"}
                    className="h-10"
                    disabled={isAdminBusy}
                    onClick={() => activeMutation.mutate()}
                    type="button"
                  >
                    {profile.isActive ? (
                      <Ban data-icon="inline-start" />
                    ) : (
                      <UserCheck data-icon="inline-start" />
                    )}
                    {profile.isActive ? "Деактивировать" : "Активировать"}
                  </Button>
                ) : null}
                <FollowButton
                  username={profile.username}
                  isFollowedByViewer={profile.isFollowedByViewer}
                  isSelf={profile.isSelf}
                  className="h-10"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form
              className="flex max-w-2xl flex-col gap-4"
              onSubmit={handleSubmit}
            >
              <FormField label="Имя" error={fieldErrors.displayName}>
                {(field) => (
                  <Input
                    {...field}
                    disabled={updateMutation.isPending}
                    maxLength={64}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    value={displayName}
                  />
                )}
              </FormField>
              <FormField label="Username" error={fieldErrors.username}>
                {(field) => (
                  <Input
                    {...field}
                    disabled={updateMutation.isPending}
                    maxLength={64}
                    minLength={3}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    value={username}
                  />
                )}
              </FormField>
              <FormField label="Описание" error={fieldErrors.bio}>
                {(field) => (
                  <Textarea
                    {...field}
                    className="min-h-28"
                    disabled={updateMutation.isPending}
                    maxLength={1000}
                    onChange={(event) => setBio(event.target.value)}
                    value={bio}
                  />
                )}
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button disabled={updateMutation.isPending} type="submit">
                  <Save data-icon="inline-start" />
                  Сохранить
                </Button>
                <Button
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={cancelEditing}
                  type="button"
                >
                  <X data-icon="inline-start" />
                  Отмена
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex max-w-3xl flex-col gap-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {profile.bio ?? "Описание профиля пока не добавлено."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {!profile.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                    <Ban className="size-3.5" />
                    Деактивирован
                  </span>
                ) : null}
                {profile.roles.map((role) => {
                  const meta = roleMeta[role];
                  const Icon = meta?.Icon ?? ShieldCheck;

                  return (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                      key={role}
                    >
                      <Icon className="size-3.5" />
                      {meta?.label ?? role}
                    </span>
                  );
                })}
                {canAdminister
                  ? manageableRoles.map(({ code, label }) => {
                      const hasRole = profile.roles.includes(code);

                      return (
                        <Button
                          key={code}
                          variant="outline"
                          size="sm"
                          disabled={isAdminBusy}
                          onClick={() =>
                            roleMutation.mutate({ role: code, grant: !hasRole })
                          }
                          type="button"
                        >
                          {hasRole ? (
                            <ShieldX data-icon="inline-start" />
                          ) : (
                            <ShieldCheck data-icon="inline-start" />
                          )}
                          {hasRole ? `Снять ${label}` : `Назначить ${label}`}
                        </Button>
                      );
                    })
                  : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwnProfile && !profile.isActive ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <Ban className="size-4 shrink-0" />
          Ваша учетная запись деактивирована администратором. Вы можете
          просматривать контент, но не можете оставлять оценки, отзывы,
          комментарии и создавать списки.
        </div>
      ) : null}
    </div>
  );
}
