import { useStore } from "@nanostores/react";
import { useEffect, useMemo, useState } from "react";
import { downloadGuides, fileSafe } from "@/components/ContentTransfer";
import { GuideToggle } from "@/components/guide/GuideToggle";
import { StepCard, type StepFilters } from "@/components/guide/StepCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { chapterById } from "@/lib/data";
import { findGuide } from "@/lib/guide/builtin";
import { duplicateGuide, groupByChapter } from "@/lib/guide/ops";
import { stepsProgress } from "@/lib/guide/progress";
import { derivedFor } from "@/lib/guide/useDerived";
import { $checks, $profile, saveGuide } from "@/lib/store";

/** One guide, all its steps, grouped by chapter (steps without a chapter come last). Client-only (`?id=`). */
export function GuideViewPage() {
  const t = useTranslations();
  const profile = useStore($profile);
  const checks = useStore($checks);
  const [id, setId] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  useEffect(() => setId(new URLSearchParams(location.search).get("id")), []);
  const guide = id ? findGuide(id, profile.guides) : undefined;
  const groups = useMemo(() => (guide ? [...groupByChapter(guide.steps)] : []), [guide]);
  if (!guide) return <p className="text-sm">{id === null ? "" : t("guides.notFound")}</p>;

  const derived = derivedFor(guide);
  const p = stepsProgress(guide, guide.steps, checks);
  const filters: StepFilters = {
    hideDone: profile.view.hideDone,
    hidePostgame: profile.view.hidePostgame,
    showFacts: profile.view.showFacts,
    buyableOnly: profile.view.buyableOnly,
    needle: needle.trim().toLowerCase(),
  };
  const q = encodeURIComponent(guide.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{guide.title}</h1>
      {guide.description && <p className="text-muted-foreground text-sm">{guide.description}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{t("step.progress", { done: p.done, total: p.total })}</Badge>
        {guide.build && (
          <Badge variant="secondary">
            {t("planner.totalAbs", { n: Math.round(derived.total.abs).toLocaleString() })} ·{" "}
            {t("planner.totalGilda", { n: Math.round(derived.total.gilda).toLocaleString() })}
          </Badge>
        )}
        <GuideToggle guideId={guide.id} />
        {guide.kind === "custom" && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/planner?edit=${q}`} />}
          >
            {t("guides.edit")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const copy = duplicateGuide(guide);
            saveGuide(copy);
            location.href = `/planner?edit=${encodeURIComponent(copy.id)}`;
          }}
        >
          {t("guides.duplicate")}
        </Button>
        {guide.kind === "custom" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadGuides(`dcc-guide-${fileSafe(guide.title)}.json`, [guide])}
          >
            {t("transfer.export")}
          </Button>
        )}
      </div>
      {derived.errors.length > 0 && (
        <ul className="text-destructive list-disc pl-5 text-sm">
          {derived.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      <Input
        type="search"
        className="max-w-xs"
        placeholder={t("chapter.search")}
        aria-label={t("chapter.search")}
        value={needle}
        onChange={(e) => setNeedle(e.target.value)}
      />
      {groups.map(([chapterId, placed]) => {
        const chapter = chapterId ? chapterById.get(chapterId) : undefined;
        const gp = stepsProgress(
          guide,
          placed.map((x) => x.step),
          checks,
        );
        const title = chapter
          ? `${chapter.phase === "main" ? `${chapter.number}. ` : ""}${chapter.title}`
          : t("dash.anytime");
        return (
          <Collapsible key={chapterId ?? "anytime"} defaultOpen={groups.length <= 2 || !!needle}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left font-medium">
              <span>{title}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {t("step.progress", { done: gp.done, total: gp.total })}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-2 pt-2">
              {placed.map(({ step, index }) => (
                <StepCard
                  key={step.id}
                  guide={guide}
                  step={step}
                  index={index}
                  derived={derived.steps.get(step.id)}
                  filters={filters}
                  showWhere={false}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
