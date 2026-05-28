import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StateCardProps = {
  title: string;
  text?: string;
  className?: string;
  /** Heading level — h1 on full-page states, h2 inside sections. */
  as?: "h1" | "h2";
};

/**
 * Centered card used for loading / error / empty states. Replaces the
 * per-page CatalogState / DetailsState / State components that were
 * structurally identical.
 */
export function StateCard({
  title,
  text,
  className,
  as: Heading = "h2",
}: StateCardProps) {
  return (
    <Card className={cn("p-8 text-center", className)}>
      <Heading className="font-semibold">{title}</Heading>
      {text ? (
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      ) : null}
    </Card>
  );
}
