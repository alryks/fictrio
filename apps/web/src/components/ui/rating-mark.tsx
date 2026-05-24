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
  sm: "h-[18px] w-4",
  md: "h-[27px] w-6",
  lg: "h-9 w-8",
};

const segmentClassNames = ["rounded-tl-[3px]", "", "rounded-br-[3px]"];
const segmentColorClassNames = [
  {
    idle: "bg-[var(--fictrio-soft)]/35",
    active: "bg-[var(--fictrio-soft)]",
  },
  {
    idle: "bg-[var(--fictrio-accent)]/25",
    active: "bg-[var(--fictrio-accent)]",
  },
  {
    idle: "bg-[var(--fictrio-primary)]/25",
    active: "bg-[var(--fictrio-primary)]",
  },
];

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
        "grid grid-rows-3 overflow-hidden rounded-tl-[3px] rounded-br-[3px]",
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
              "relative overflow-hidden",
              segmentClassNames[segmentIndex],
              segmentColorClassNames[segmentIndex].idle,
            )}
          >
            <span
              className={cn(
                "absolute inset-x-0 bottom-0",
                segmentColorClassNames[segmentIndex].active,
              )}
              style={{ height: `${fill * 100}%` }}
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
