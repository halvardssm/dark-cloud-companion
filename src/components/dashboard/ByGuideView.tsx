import { useState } from "react";
import { StepCard, type StepFilters } from "@/components/guide/StepCard";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import { chapters } from "@/lib/data";
import { guideProgress, isStepDone } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";
import { derivedFor } from "@/lib/guide/useDerived";

const PAGE = 5;

/** One panel per switched-on guide with its next open steps; chapters become a filter. */
export function ByGuideView({
  guides,
  checks,
  filters,
}: {
  guides: Guide[];
  checks: Record<string, true>;
  filters: StepFilters;
}) {
  const t = useTranslations();
  const [chapterId, setChapterId] = useState("");
  const [shown, setShown] = useState<Record<string, number>>({});

  return (
    <div className="flex flex-col gap-6">
      <select
        className="bg-background h-9 w-fit rounded-md border px-2 text-sm"
        value={chapterId}
        onChange={(e) => setChapterId(e.target.value)}
        aria-label={t("dash.chapterFilter")}
      >
        <option value="">{t("dash.allChapters")}</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.phase === "main" ? `${c.number}. ` : ""}
            {c.title}
          </option>
        ))}
      </select>
      {guides.length === 0 && <p className="text-muted-foreground text-sm">{t("dash.noActive")}</p>}
      {guides.map((g) => {
        const p = guideProgress(g, checks);
        const pool = g.steps
          .map((step, index) => ({ step, index }))
          .filter((x) => !chapterId || x.step.chapterId === chapterId)
          .filter((x) => !isStepDone(g, x.step, checks));
        const limit = shown[g.id] ?? PAGE;
        const derived = derivedFor(g);
        return (
          <section key={g.id} className="flex flex-col gap-2">
            <h2 className="flex items-baseline justify-between gap-2 text-lg font-semibold">
              <a className="hover:underline" href={`/guides/view?id=${encodeURIComponent(g.id)}`}>
                {g.title}
              </a>
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {t("step.progress", { done: p.done, total: p.total })}
              </span>
            </h2>
            {pool.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("dash.allDone")}</p>
            )}
            {pool.slice(0, limit).map(({ step, index }) => (
              <StepCard
                key={step.id}
                guide={g}
                step={step}
                index={index}
                derived={derived.steps.get(step.id)}
                filters={filters}
              />
            ))}
            {pool.length > limit && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setShown({ ...shown, [g.id]: limit + PAGE })}
              >
                {t("dash.moreSteps", { n: Math.min(PAGE, pool.length - limit) })}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
