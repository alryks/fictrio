import { getWorksCountLabel } from "@/lib/format";
import { WorkCard } from "./work-card";
import type { WorkListItem } from "./works-api";

type WorkRailProps = {
  title?: string;
  works: WorkListItem[];
  emptyText?: string;
};

export function WorkRail({ title, works, emptyText }: WorkRailProps) {
  return (
    <section className="min-w-0">
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <span className="text-sm text-muted-foreground">
            {works.length} {getWorksCountLabel(works.length)}
          </span>
        </div>
      ) : null}

      {works.length ? (
        <div className="min-w-0 overflow-hidden">
          <div className="-mx-5 mt-4 flex max-w-full gap-4 overflow-x-auto px-5 pb-3">
            {works.map((work) => (
              <div key={work.id} className="w-40 shrink-0 sm:w-44">
                <WorkCard work={work} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-md border bg-background p-4 text-sm text-muted-foreground">
          {emptyText ?? "Произведения пока не добавлены."}
        </p>
      )}
    </section>
  );
}
