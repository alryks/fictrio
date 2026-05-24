"use client";

import { cn } from "@/lib/utils";

type RatingMarkSize = "sm" | "md" | "lg";

type RatingMarkProps = {
  value: number;
  className?: string;
  size?: RatingMarkSize;
  label?: string;
  onValueChange?: (value: number) => void;
};

const sizeClassNames: Record<RatingMarkSize, string> = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10",
};

const segmentClassNames = ["rounded-tl-[38%]", "", "rounded-br-[38%]"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSegmentFill(value: number, segmentIndexFromTop: number) {
  const segmentIndexFromBottom = 2 - segmentIndexFromTop;

  return clamp(value - segmentIndexFromBottom, 0, 1);
}

export function RatingMark({
  value,
  className,
  size = "md",
  label,
  onValueChange,
}: RatingMarkProps) {
  const normalizedValue = clamp(value, 0, 3);
  const accessibleLabel =
    label ?? `Оценка ${normalizedValue.toFixed(1).replace(".", ",")} из 3`;
  const mark = (
    <span
      className={cn(
        "grid overflow-hidden rounded-tl-[38%] rounded-br-[38%] bg-[var(--fictrio-soft)]/35",
        sizeClassNames[size],
        className,
      )}
      aria-hidden="true"
    >
      {[0, 1, 2].map((segmentIndex) => {
        const fill = getSegmentFill(normalizedValue, segmentIndex);

        return (
          <span
            key={segmentIndex}
            className={cn(
              "relative overflow-hidden bg-[var(--fictrio-soft)]/35",
              segmentClassNames[segmentIndex],
            )}
          >
            <span
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${fill * 100}%` }}
            />
          </span>
        );
      })}
    </span>
  );

  if (!onValueChange) {
    return (
      <span
        className="inline-flex items-center gap-2"
        aria-label={accessibleLabel}
      >
        {mark}
        <span className="font-medium text-primary">
          {normalizedValue.toFixed(1).replace(".", ",")}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={accessibleLabel}
      onClick={() => onValueChange((Math.floor(normalizedValue) + 1) % 4)}
    >
      {mark}
      <span className="font-medium text-primary">{normalizedValue}</span>
    </button>
  );
}
