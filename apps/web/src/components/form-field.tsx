import { ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  error?: string;
  /** Render prop receiving the id/aria props to spread on the control. */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
};

/**
 * Label + control + inline error wrapper. Wires up id/aria-invalid/
 * aria-describedby so every form field across the app behaves and looks
 * the same.
 */
export function FormField({ label, error, children }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
