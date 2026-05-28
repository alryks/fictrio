"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <Button
          aria-label="Изменить оценку"
          className="size-10 hover:bg-muted/60"
          disabled={disabled}
          onClick={onChange}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RatingMark value={value} size="xl" />
        </Button>
        <Button
          aria-label="Удалить оценку"
          className="size-10 border-0"
          disabled={isDeleteDisabled}
          onClick={onDelete}
          size="icon"
          type="button"
          variant="destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
