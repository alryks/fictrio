"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Badge marking content that has been hidden by a moderator. Only privileged
 * viewers (moderators, admins, the author/owner) ever see hidden content, so
 * the badge explains why it looks different from the rest of the feed.
 */
export function HiddenBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive",
        className,
      )}
    >
      <EyeOff className="size-3" />
      Скрыто модератором
    </span>
  );
}

type ModerationToggleButtonProps = {
  isHidden: boolean;
  isPending: boolean;
  onToggle: () => void;
  size?: "xs" | "sm";
  className?: string;
};

/**
 * Hide/restore toggle shown next to moderated content for moderators. Hiding
 * is a destructive action (red); restoring is a neutral outline button.
 */
export function ModerationToggleButton({
  isHidden,
  isPending,
  onToggle,
  size = "sm",
  className,
}: ModerationToggleButtonProps) {
  return (
    <Button
      variant={isHidden ? "outline" : "destructive"}
      size={size}
      className={className}
      disabled={isPending}
      onClick={onToggle}
      type="button"
    >
      {isHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      {isHidden ? "Раскрыть" : "Скрыть"}
    </Button>
  );
}
