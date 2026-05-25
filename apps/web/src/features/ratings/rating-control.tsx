"use client";

import { Trash2 } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";

type RatingControlProps = {
  value: number;
  label?: string;
  disabled?: boolean;
  deleteDisabled?: boolean;
  onChange: () => void;
  onDelete: () => void;
};

export function RatingControl({
  value,
  label = "Ваша оценка",
  disabled = false,
  deleteDisabled = false,
  onChange,
  onDelete,
}: RatingControlProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <button
          aria-label="Изменить оценку"
          className="grid size-14 place-items-center rounded-md transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          disabled={disabled}
          onClick={onChange}
          type="button"
        >
          <RatingMark value={value} size="lg" />
        </button>
        <button
          aria-label="Удалить оценку"
          className="grid size-14 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
          disabled={deleteDisabled}
          onClick={onDelete}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
