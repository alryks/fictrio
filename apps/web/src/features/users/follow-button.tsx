"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query-keys";
import { requireUser } from "@/lib/require-user";
import { useSession } from "@/features/auth/use-session";
import { followUser, unfollowUser } from "./users-api";

type FollowButtonProps = {
  username: string;
  isFollowedByViewer: boolean;
  isSelf: boolean;
  size?: "default" | "sm";
  className?: string;
};

/**
 * Follow/unfollow toggle. After a successful change it invalidates every user
 * list and the feeds, so search results, follower/following lists, the profile
 * header counters and the following feed all stay in sync.
 */
export function FollowButton({
  username,
  isFollowedByViewer,
  isSelf,
  size = "default",
  className,
}: FollowButtonProps) {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const mutation = useMutation({
    mutationFn: () => {
      requireUser(user, isFollowedByViewer ? "отписки" : "подписки");
      return isFollowedByViewer ? unfollowUser(username) : followUser(username);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.users.all }),
        queryClient.invalidateQueries({ queryKey: qk.users.profile(username) }),
        queryClient.invalidateQueries({ queryKey: qk.feed.all }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось изменить подписку",
      );
    },
  });

  if (isSelf) {
    return null;
  }

  return (
    <Button
      className={className}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      size={size}
      type="button"
      variant={isFollowedByViewer ? "outline" : "default"}
    >
      {isFollowedByViewer ? (
        <>
          <UserMinus data-icon="inline-start" />
          Отписаться
        </>
      ) : (
        <>
          <UserPlus data-icon="inline-start" />
          Подписаться
        </>
      )}
    </Button>
  );
}
