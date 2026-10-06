// Which chapter the dashboard follows, and which steps of a guide belong to a chapter.
import { chapters } from "@/lib/data";
import { stepsProgress } from "./progress";
import type { Guide, Step } from "./types";

export const MAIN_CHAPTERS = chapters.filter((c) => c.phase === "main");

export interface PlacedStep {
  step: Step;
  index: number;
}

export const stepsInChapter = (guide: Guide, chapterId: string): PlacedStep[] =>
  guide.steps.map((step, index) => ({ step, index })).filter((p) => p.step.chapterId === chapterId);

export const anytimeSteps = (guide: Guide): PlacedStep[] =>
  guide.steps.map((step, index) => ({ step, index })).filter((p) => !p.step.chapterId);

const chapterNumber = (id: string | undefined) => chapters.find((c) => c.id === id)?.number;

/** Unfinished steps of earlier chapters, for guides where that matters (weapon builds, own guides). */
export function carriedSteps(
  guide: Guide,
  chapterId: string,
  isDone: (s: Step) => boolean,
): (PlacedStep & { from: number })[] {
  const current = chapterNumber(chapterId);
  if (current === undefined) return [];
  return guide.steps
    .map((step, index) => ({ step, index, from: chapterNumber(step.chapterId) }))
    .filter(
      (p): p is PlacedStep & { from: number } =>
        p.from !== undefined && p.from < current && !isDone(p.step),
    );
}

/** First main chapter whose steps in the main walkthrough aren't all done (the last one when everything is). */
export function firstIncompleteChapter(main: Guide, checks: Record<string, true>): string {
  for (const c of MAIN_CHAPTERS) {
    const p = stepsProgress(
      main,
      stepsInChapter(main, c.id).map((x) => x.step),
      checks,
    );
    if (p.total > 0 && p.done < p.total) return c.id;
  }
  return MAIN_CHAPTERS[MAIN_CHAPTERS.length - 1].id;
}

export function chapterProgressOf(guide: Guide, chapterId: string, checks: Record<string, true>) {
  return stepsProgress(
    guide,
    stepsInChapter(guide, chapterId).map((x) => x.step),
    checks,
  );
}
