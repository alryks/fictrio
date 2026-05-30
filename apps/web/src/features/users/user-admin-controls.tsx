"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Shield, ShieldCheck, ShieldX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type {
  ManageableRole,
  PublicUserProfile,
  SelfUser,
} from "@fictrio/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { qk } from "@/lib/query-keys";
import { isAdmin } from "@/lib/roles";
import {
  assignUserRole,
  removeUserRole,
  setUserActive,
} from "./users-api";

const manageableRoles: Array<{ code: ManageableRole; label: string }> = [
  { code: "moderator", label: "модератора" },
  { code: "admin", label: "администратора" },
];

/**
 * Administrator-only block on another user's profile: activate/deactivate the
 * account and grant/revoke the moderator and administrator roles. Hidden for
 * non-admins and on the administrator's own profile.
 */
export function UserAdminControls({
  profile,
  viewer,
}: {
  profile: PublicUserProfile;
  viewer: SelfUser | null;
}) {
  const queryClient = useQueryClient();
  const isOwnProfile = viewer?.id === profile.id;

  const applyUpdate = (updated: PublicUserProfile) => {
    queryClient.setQueryData(qk.users.profile(profile.username), updated);
    return queryClient.invalidateQueries({ queryKey: qk.users.all });
  };

  const activeMutation = useMutation({
    mutationFn: () => setUserActive(profile.username, !profile.isActive),
    onSuccess: async (updated) => {
      await applyUpdate(updated);
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
    mutationFn: ({
      role,
      grant,
    }: {
      role: ManageableRole;
      grant: boolean;
    }) =>
      grant
        ? assignUserRole(profile.username, role)
        : removeUserRole(profile.username, role),
    onSuccess: async (updated) => {
      await applyUpdate(updated);
      toast.success("Роли обновлены");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось изменить роли",
      );
    },
  });

  if (!isAdmin(viewer) || isOwnProfile) {
    return null;
  }

  const isBusy = activeMutation.isPending || roleMutation.isPending;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4 text-primary" />
          Управление пользователем
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {profile.isActive
              ? "Учетная запись активна."
              : "Учетная запись деактивирована."}
          </p>
          <Button
            variant={profile.isActive ? "destructive" : "default"}
            disabled={isBusy}
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
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Роли</p>
          <div className="flex flex-wrap gap-2">
            {manageableRoles.map(({ code, label }) => {
              const hasRole = profile.roles.includes(code);

              return (
                <Button
                  key={code}
                  variant="outline"
                  disabled={isBusy}
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
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
