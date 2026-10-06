import { useMemo } from "react";
import { useStore } from "@nanostores/react";
import { CheckRow } from "@/components/chapter/CheckRow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "@/i18n";
import { chapterById, sectionById } from "@/lib/data";
import type { DerivedStep } from "@/lib/guide/derive";
import { stepProgress } from "@/lib/guide/progress";
import { resolveEntry } from "@/lib/guide/refs";
import { stepTickId, textTickId, type Entry, type Guide, type Step } from "@/lib/guide/types";
import { $checks, $profile, setChecked } from "@/lib/store";
import { BuildStepBody } from "./BuildStepBody";
import { ItemRow } from "./ItemRow";
import { SectionFacts } from "./SectionFacts";

export interface StepFilters {
  hideDone: boolean;
  hidePostgame: boolean;
  showFacts: boolean;
  /** Lowercased search text; entries that don't match are hidden. */
  needle: string;
}

/** Entries that survive the view filters (hide done / post-game / search). */
export function visibleEntries(
  guide: Guide,
  step: Step,
  checks: Record<string, true>,
  f: StepFilters,
): Entry[] {
  return step.entries.filter((e) => {
    if (e.kind === "text") {
      if (f.hideDone && checks[textTickId(guide.id, step.id, e.id)]) return false;
      return !f.needle || e.text.toLowerCase().includes(f.needle);
    }
    const r = resolveEntry(e);
    if (r.kind === "missing") return false;
    if (r.kind === "item") {
      if (f.hidePostgame && r.item.postgame) return false;
      if (f.hideDone && checks[r.item.id]) return false;
      return !f.needle || r.item.name.toLowerCase().includes(f.needle);
    }
    // Section facts: hidden while searching; hide when every medal is done and "hide done" is on.
    if (f.needle) return false;
    return !(f.hideDone && r.medals.length > 0 && r.medals.every((m) => checks[m.id]));
  });
}

interface Props {
  guide: Guide;
  step: Step;
  index: number;
  derived?: DerivedStep;
  filters: StepFilters;
  /** Chapter number the step was carried over from, when shown in a later chapter. */
  carriedFrom?: number;
  showWhere?: boolean;
}

export function StepCard({
  guide,
  step,
  index,
  derived,
  filters,
  carriedFrom,
  showWhere = true,
}: Props) {
  const t = useTranslations();
  const checks = useStore($checks);
  useStore($profile); // re-render with the profile (guide edits)
  const entries = useMemo(
    () => visibleEntries(guide, step, checks, filters),
    [guide, step, checks, filters],
  );
  if (step.entries.length > 0 && entries.length === 0 && !step.build && !step.notes) return null;

  const progress = stepProgress(guide, step, checks);
  const ownTick =
    step.build || step.entries.length === 0 ? stepTickId(guide.id, step.id) : undefined;
  const chapter = step.chapterId ? chapterById.get(step.chapterId) : undefined;
  const section = step.sectionId ? sectionById.get(step.sectionId) : undefined;
  const complete = progress.total > 0 && progress.done === progress.total;
  const showCounter = step.entries.length > 0 && progress.total > 0;

  return (
    <Card size="sm" className={complete ? "opacity-70" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {ownTick && (
            <Checkbox
              checked={!!checks[ownTick]}
              onCheckedChange={(v) => setChecked(ownTick, v === true)}
              aria-label={step.title || t("step.markDone")}
            />
          )}
          <span>{step.title || `${index + 1}`}</span>
          {showWhere && chapter && (
            <Badge variant="outline">
              {chapter.phase === "main" ? `${chapter.number}. ` : ""}
              {chapter.title}
              {section && section.title !== step.title ? ` › ${section.title}` : ""}
            </Badge>
          )}
          {carriedFrom !== undefined && (
            <Badge variant="secondary">{t("step.carried", { n: carriedFrom })}</Badge>
          )}
          {showCounter && (
            <span className="text-muted-foreground ml-auto text-xs font-normal tabular-nums">
              {t("step.progress", { done: progress.done, total: progress.total })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {step.notes && <p className="text-sm whitespace-pre-wrap">{step.notes}</p>}
        <BuildStepBody step={step} derived={derived} />
        {entries.map((e, i) => {
          if (e.kind === "text") {
            const id = textTickId(guide.id, step.id, e.id);
            return (
              <CheckRow
                key={`t${e.id}`}
                checked={!!checks[id]}
                onChange={(v) => setChecked(id, v)}
                label={e.text}
              />
            );
          }
          const r = resolveEntry(e);
          if (r.kind === "item") return <ItemRow key={`i${e.ref}`} item={r.item} checks={checks} />;
          if (r.kind === "section")
            return (
              <SectionFacts
                key={`s${e.ref}-${i}`}
                section={r.section}
                medals={r.medals}
                checks={checks}
                showFacts={filters.showFacts}
              />
            );
          return null;
        })}
      </CardContent>
    </Card>
  );
}
