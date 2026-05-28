import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PosterPlaceholderProps = {
  imageUrl?: string | null;
  className?: string;
  children?: ReactNode;
};

/**
 * Poster surface for a work: shows the cover image when available, otherwise
 * a brand-token gradient. Replaces the hard-coded hex gradient duplicated
 * across the catalog card and detail views.
 */
export function PosterPlaceholder({
  imageUrl,
  className,
  children,
}: PosterPlaceholderProps) {
  return (
    <div
      className={cn(
        "bg-linear-to-br from-[var(--fictrio-primary)] via-[var(--fictrio-accent)] to-[var(--fictrio-soft)] bg-cover bg-center",
        className,
      )}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      {children}
    </div>
  );
}
