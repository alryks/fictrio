"use client";

import { cn } from "@/lib/utils";

type RatingMarkSize = "sm" | "md" | "lg" | "xl";

type RatingMarkProps = {
  value: number;
  className?: string;
  size?: RatingMarkSize;
};

const sizeClassNames: Record<RatingMarkSize, string> = {
  sm: "h-[18px] w-4",
  md: "h-[27px] w-6",
  lg: "h-9 w-8",
  xl: "h-10 w-9",
};

const radiusClassNames: Record<RatingMarkSize, string> = {
  sm: "rounded-tl-[3px] rounded-br-[3px]",
  md: "rounded-tl-[4.5px] rounded-br-[4.5px]",
  lg: "rounded-tl-[6px] rounded-br-[6px]",
  xl: "rounded-tl-[6.667px] rounded-br-[6.667px]",
};

const segmentColorClassNames = [
  {
    idle: "bg-[var(--fictrio-soft)]/35 group-hover/button:bg-[var(--fictrio-soft)]/45",
    active:
      "bg-[var(--fictrio-soft)] group-hover/button:bg-[color-mix(in_srgb,var(--fictrio-soft)_82%,black)]",
  },
  {
    idle:
      "bg-[var(--fictrio-accent)]/35 group-hover/button:bg-[var(--fictrio-accent)]/45",
    active:
      "bg-[var(--fictrio-accent)] group-hover/button:bg-[color-mix(in_srgb,var(--fictrio-accent)_82%,black)]",
  },
  {
    idle:
      "bg-[var(--fictrio-primary)]/35 group-hover/button:bg-[var(--fictrio-primary)]/45",
    active:
      "bg-[var(--fictrio-primary)] group-hover/button:bg-[color-mix(in_srgb,var(--fictrio-primary)_82%,black)]",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSegmentFill(value: number, segmentIndexFromTop: number) {
  const segmentIndexFromBottom = 2 - segmentIndexFromTop;

  return clamp(value - segmentIndexFromBottom, 0, 1);
}

export function RatingMark({ value, className, size = "md" }: RatingMarkProps) {
  const normalizedValue = clamp(value, 0, 3);
  const accessibleLabel = `Оценка ${normalizedValue
    .toFixed(1)
    .replace(".", ",")} из 3`;
  const mark = (
    <span
      className={cn(
        "grid grid-rows-3 overflow-hidden transition-colors",
        sizeClassNames[size],
        radiusClassNames[size],
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
              "relative overflow-hidden transition-colors",
              segmentColorClassNames[segmentIndex].idle,
            )}
          >
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 transition-colors",
                segmentColorClassNames[segmentIndex].active,
              )}
              style={{ height: `${fill * 100}%` }}
            />
          </span>
        );
      })}
    </span>
  );

  return (
    <span className="inline-flex items-center" aria-label={accessibleLabel}>
      {mark}
    </span>
  );
}
