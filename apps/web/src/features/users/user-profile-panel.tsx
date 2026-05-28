"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import type { PublicUserProfile, SelfUser } from "@fictrio/contracts";
import { FormField } from "@/components/form-field";
import { UserBadge } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { useSessionActions } from "@/features/auth/use-session";
import { updateMyProfile } from "./users-api";

type FieldErrors = Record<string, string>;

type UserProfilePanelProps = {
  profile: PublicUserProfile;
  viewer: SelfUser | null;
};

const roleLabels: Record<string, string> = {
  user: "Пользователь",
  moderator: "Модератор",
  admin: "Администратор",
};

export function UserProfilePanel({ profile, viewer }: UserProfilePanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { setUser } = useSessionActions();
  const isOwnProfile = viewer?.id === profile.id;
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
            </div>
          </div>
          {isOwnProfile && !isEditing ? (
            <Button
              variant="outline"
              className="h-10"
              onClick={startEditing}
              type="button"
            >
              <Pencil data-icon="inline-start" />
              Изменить
            </Button>
          ) : null}
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
            <div className="flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <span
                  className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                  key={role}
                >
                  <ShieldCheck />
                  {roleLabels[role] ?? role}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
