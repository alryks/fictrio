"use client";

import { RatingMark } from "@/components/ui/rating-mark";
import { cn } from "@/lib/utils";

type AverageRatingSummaryProps = {
  average: number | null;
  count: number;
  className?: string;
  onClick?: () => void;
};

export function AverageRatingSummary({
  average,
  count,
  className,
  onClick,
}: AverageRatingSummaryProps) {
  const content = (
    <>
      <RatingMark value={average ?? 0} size="lg" />
      <div className="text-right">
        <p className="text-xl font-semibold text-primary">
          {(average ?? 0).toFixed(1)}/3.0
        </p>
        <p className="text-xs text-muted-foreground">{count} шт.</p>
      </div>
    </>
  );
  const classNames = cn(
    "flex shrink-0 items-center gap-3 rounded-md border bg-background px-4 py-3 text-left",
    className,
  );

  if (onClick) {
    return (
      <button
        aria-label="Перейти к оценкам"
        className={cn(
          classNames,
          "transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <div className={classNames}>{content}</div>;
}
