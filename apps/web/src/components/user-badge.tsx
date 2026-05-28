import { cn } from "@/lib/utils";

type UserBadgeSize = "sm" | "md";

type UserBadgeProps = {
  /** Used to derive the two-letter initials. */
  name: string;
  size?: UserBadgeSize;
  /** primary tone for the signed-in user, accent for everyone else. */
  tone?: "accent" | "primary";
  className?: string;
};

const sizeClassNames: Record<UserBadgeSize, string> = {
  sm: "size-10 text-sm",
  md: "size-11 text-sm",
};

const toneClassNames = {
  accent: "bg-accent text-accent-foreground",
  primary: "bg-primary text-primary-foreground",
};

/** Square avatar showing the first two letters of a name. */
export function UserBadge({
  name,
  size = "sm",
  tone = "accent",
  className,
}: UserBadgeProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold",
        sizeClassNames[size],
        toneClassNames[tone],
        className,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
