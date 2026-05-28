"use client";

import Link from "next/link";
import { UserBadge } from "@/components/user-badge";
import { cn } from "@/lib/utils";

type UserLinkUser = {
  username: string;
  displayName: string;
};

type UserLinkProps = {
  user: UserLinkUser;
  meta?: string;
  className?: string;
};

export function UserLink({ user, meta, className }: UserLinkProps) {
  return (
    <Link
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      href={`/users/${user.username}`}
    >
      <UserBadge name={user.username} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">
          {user.displayName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          @{user.username}
          {meta ? ` · ${meta}` : ""}
        </span>
      </span>
    </Link>
  );
}
