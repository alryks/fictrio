"use client";

import { Trash2 } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";

type RatingControlProps = {
  value: number;
  hasValue: boolean;
  label?: string;
  disabled?: boolean;
  deleteDisabled?: boolean;
  onChange: () => void;
  onDelete: () => void;
};

export function RatingControl({
  value,
  hasValue,
  label = "Ваша оценка",
  disabled = false,
  deleteDisabled = false,
  onChange,
  onDelete,
}: RatingControlProps) {
  const isDeleteDisabled = deleteDisabled || !hasValue;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <button
          aria-label="Изменить оценку"
          className="grid size-10 place-items-center rounded-md transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={onChange}
          type="button"
        >
          <RatingMark value={value} size="xl" />
        </button>
        <button
          aria-label="Удалить оценку"
          className="grid size-10 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted/40 disabled:text-muted-foreground/40 disabled:opacity-100"
          disabled={isDeleteDisabled}
          onClick={onDelete}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
