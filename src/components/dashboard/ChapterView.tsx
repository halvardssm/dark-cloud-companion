import { useState } from "react";
import { CheckRow } from "@/components/chapter/CheckRow";
import type { StepFilters } from "@/components/guide/StepCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { chapterById, chapters } from "@/lib/data";
import {
  carriedSteps,
  anytimeSteps,
  chapterProgressOfGuides,
  openMissable,
  stepsInChapter,
} from "@/lib/guide/dashboard";
import { isStepDone } from "@/lib/guide/progress";
import { derivedFor } from "@/lib/guide/useDerived";
import type { Guide } from "@/lib/guide/types";
import { setChecked, setCurrentChapter } from "@/lib/store";
import type { Profile } from "@/lib/profiles";
import { GuideBlock } from "./GuideBlock";

interface Props {
  guides: Guide[];
  profile: Profile;
  checks: Record<string, true>;
  chapterId: string;
  currentId: string;
  onChapter: (id: string) => void;
  filters: StepFilters;
}

/** The dashboard's chapter view: this chapter's steps from every switched-on guide. */
export function ChapterView({
  guides,
  profile,
  checks,
  chapterId,
  currentId,
  onChapter,
  filters,
}: Props) {
  const t = useTranslations();
  const chapter = chapterById.get(chapterId)!;
  const index = chapters.findIndex((c) => c.id === chapterId);
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const mainProgress = chapterProgressOfGuides(guides, chapterId, checks);
  const pct = mainProgress.total ? Math.round((mainProgress.done / mainProgress.total) * 100) : 0;
  const [showAnytime, setShowAnytime] = useState(false);

  // Missable items from the switched-on guides that are still open up to and including this chapter.
  const missable = openMissable(guides, checks, chapter.number);

  const blocks = guides
    .map((guide) => {
      const here = stepsInChapter(guide, chapterId).map((p) => ({
        ...p,
        from: undefined as number | undefined,
      }));
      // The main walkthrough lists everything per chapter already; other guides also show unfinished earlier steps.
      const carried =
        guide.id === "main"
          ? []
          : carriedSteps(guide, chapterId, (s) => isStepDone(guide, s, checks));
      return { guide, placed: [...carried, ...here] };
    })
    .filter((b) => b.placed.length > 0);
  const anytime = guides
    .map((guide) => ({ guide, placed: anytimeSteps(guide) }))
    .filter((b) => b.placed.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">
            {chapter.phase === "main" ? `${chapter.number}. ` : ""}
            {chapter.title}
          </h2>
          {mainProgress.total > 0 && (
            <span className="text-muted-foreground text-sm tabular-nums">
              {t("step.progress", { done: mainProgress.done, total: mainProgress.total })}
            </span>
          )}
        </div>
        {mainProgress.total > 0 && (
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="bg-background h-9 rounded-md border px-2 text-sm"
            value={chapterId}
            onChange={(e) => onChapter(e.target.value)}
            aria-label={t("dash.chapter")}
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.phase === "main" ? `${c.number}. ` : ""}
                {c.title}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            aria-label={t("dash.prev")}
            disabled={!prev}
            onClick={() => prev && onChapter(prev.id)}
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={t("dash.next")}
            disabled={!next}
            onClick={() => next && onChapter(next.id)}
          >
            →
          </Button>
          {chapterId === currentId ? (
            <Badge>{t("dash.isCurrent")}</Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCurrentChapter(chapterId)}>
              {t("dash.setCurrent")}
            </Button>
          )}
          {profile.dashboard.currentChapter !== null && (
            <Button variant="ghost" size="sm" onClick={() => setCurrentChapter(null)}>
              {t("dash.followProgress")}
            </Button>
          )}
        </div>
        {mainProgress.total > 0 && mainProgress.done === mainProgress.total && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{t("dash.chapterDone")}</span>
            {next && (
              <Button
                size="sm"
                onClick={() => {
                  onChapter(next.id);
                  if (chapterId === currentId) setCurrentChapter(next.id);
                }}
              >
                {t("dash.goNext", { title: next.title })}
              </Button>
            )}
          </div>
        )}
      </header>

      {missable.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">{t("dash.missableOpen")}</CardTitle>
          </CardHeader>
          <CardContent>
            {missable.map((i) => (
              <CheckRow
                key={i.id}
                checked={false}
                onChange={(v) => setChecked(i.id, v)}
                label={i.name}
                detail={chapterById.get(i.chapterId)?.title}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {blocks.length === 0 && anytime.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("dash.noActive")}</p>
      )}

      {blocks.map(({ guide, placed }) => (
        <GuideBlock
          key={guide.id}
          guide={guide}
          placed={placed}
          derived={derivedFor(guide)}
          filters={filters}
          chapterNumber={chapter.number}
        />
      ))}

      {anytime.length > 0 && (
        <Collapsible open={showAnytime} onOpenChange={setShowAnytime}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left font-medium">
            <span>{t("dash.anytime")}</span>
            <span className="text-muted-foreground text-sm">
              {anytime.reduce((n, b) => n + b.placed.length, 0)}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-3">
            {anytime.map(({ guide, placed }) => (
              <GuideBlock
                key={guide.id}
                guide={guide}
                placed={placed}
                derived={derivedFor(guide)}
                filters={filters}
                chapterNumber={undefined}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  onNeedle,
  needle,
}: {
  filters: StepFilters;
  needle: string;
  onNeedle: (s: string) => void;
}) {
  const t = useTranslations();
  void filters;
  return (
    <Input
      type="search"
      placeholder={t("chapter.search")}
      aria-label={t("chapter.search")}
      value={needle}
      onChange={(e) => onNeedle(e.target.value)}
    />
  );
}
