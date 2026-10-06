import { StepCard, type StepFilters } from "@/components/guide/StepCard";
import { withBase } from "@/lib/base";
import { chapters } from "@/lib/data";
import type { DerivedBuild } from "@/lib/guide/derive";
import type { PlacedStep } from "@/lib/guide/dashboard";
import type { Guide } from "@/lib/guide/types";

/** One guide's steps inside a view. `carried` steps come from earlier chapters. */
export function GuideBlock({
  guide,
  placed,
  derived,
  filters,
  chapterNumber,
}: {
  guide: Guide;
  placed: (PlacedStep & { from?: number })[];
  derived: DerivedBuild;
  filters: StepFilters;
  chapterNumber: number | undefined;
}) {
  return (
    <section className="flex flex-col gap-2">
      {guide.id !== "main" && (
        <h3 className="text-sm font-medium">
          <a
            className="hover:underline"
            href={withBase(`/guides/view?id=${encodeURIComponent(guide.id)}`)}
          >
            {guide.title}
          </a>
        </h3>
      )}
      {placed.map(({ step, index, from }) => (
        <StepCard
          key={step.id}
          guide={guide}
          step={step}
          index={index}
          derived={derived.steps.get(step.id)}
          filters={filters}
          showWhere={false}
          carriedFrom={
            from !== undefined && chapterNumber !== undefined && from < chapterNumber
              ? from
              : undefined
          }
        />
      ))}
    </section>
  );
}

export const chapterNumberOf = (id: string) => chapters.find((c) => c.id === id)?.number;
