"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getFollowersCountLabel,
  getFollowingCountLabel,
} from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { UserList } from "./user-list";
import { getFollowers, getFollowing } from "./users-api";

type FollowListMode = "followers" | "following";

type FollowListDialogProps = {
  username: string;
  mode: FollowListMode;
  count: number;
};

/**
 * A clickable follower/following counter that opens a dialog listing the
 * users, using the same searchable infinite-scroll list as the people page.
 */
export function FollowListDialog({
  username,
  mode,
  count,
}: FollowListDialogProps) {
  const [open, setOpen] = useState(false);
  const isFollowers = mode === "followers";
  const label = isFollowers
    ? getFollowersCountLabel(count)
    : getFollowingCountLabel(count);
  const title = isFollowers ? "Подписчики" : "Подписки";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-baseline gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          type="button"
        >
          <span className="font-semibold text-foreground">{count}</span>
          {label}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>@{username}</DialogDescription>
        </DialogHeader>
        {open ? (
          <UserList
            bounded
            queryKey={(search) =>
              isFollowers
                ? qk.users.followers(username, search)
                : qk.users.following(username, search)
            }
            fetchPage={(search, offset) =>
              isFollowers
                ? getFollowers(username, search, offset)
                : getFollowing(username, search, offset)
            }
            emptyTitle={
              isFollowers ? "Пока нет подписчиков" : "Пока нет подписок"
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
