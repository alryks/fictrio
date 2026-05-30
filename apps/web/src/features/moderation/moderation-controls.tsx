"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Banner placed directly above hidden content (a review or comment body),
 * explaining that a moderator hid it. Privileged viewers (moderators, admins,
 * the author) still read the content below; the banner is the only visual
 * marker — the card keeps its normal border and background.
 */
export function HiddenNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-1.5 rounded-md w-fit bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <EyeOff className="size-3.5 shrink-0" />
      Скрыто модератором
    </div>
  );
}

type ModerationIconButtonProps = {
  isHidden: boolean;
  isPending: boolean;
  onToggle: () => void;
  className?: string;
};

/**
 * Square, icon-only hide/restore control for moderators, sized to line up
 * with the rating mark (h-10) it sits next to. Eye = restore a hidden post,
 * EyeOff = hide a visible one.
 */
export function ModerationIconButton({
  isHidden,
  isPending,
  onToggle,
  className,
}: ModerationIconButtonProps) {
  const label = isHidden ? "Раскрыть" : "Скрыть";

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("size-10", className)}
      disabled={isPending}
      onClick={onToggle}
      title={label}
      type="button"
    >
      {isHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
