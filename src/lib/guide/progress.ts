import { entryTickIds } from "./refs";
import { stepTickId, type Guide, type Step } from "./types";

/**
 * Tick ids that make up a step's progress: every entry's ticks (text entries are per guide; item and section
 * entries use the data item's own ticks), plus the step's own tick when it has a build or no entries at all.
 */
export function stepTickIds(guide: Guide, step: Step): string[] {
  const own = step.build || step.entries.length === 0 ? [stepTickId(guide.id, step.id)] : [];
  return [...step.entries.flatMap((e) => entryTickIds(guide.id, step.id, e)), ...own];
}

export interface Progress {
  done: number;
  total: number;
}

export function stepProgress(guide: Guide, step: Step, checks: Record<string, true>): Progress {
  const ids = stepTickIds(guide, step);
  return { done: ids.filter((id) => checks[id]).length, total: ids.length };
}

export function stepsProgress(guide: Guide, steps: Step[], checks: Record<string, true>): Progress {
  let done = 0;
  let total = 0;
  for (const s of steps) {
    const p = stepProgress(guide, s, checks);
    done += p.done;
    total += p.total;
  }
  return { done, total };
}

export const guideProgress = (guide: Guide, checks: Record<string, true>) =>
  stepsProgress(guide, guide.steps, checks);

export const isStepDone = (guide: Guide, step: Step, checks: Record<string, true>) => {
  const p = stepProgress(guide, step, checks);
  return p.total > 0 && p.done === p.total;
};
