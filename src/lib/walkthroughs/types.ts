import { z } from "zod";

export const walkthroughItem = z.object({
  id: z.string().min(1),
  text: z.string().max(500),
});

export const walkthroughStep = z.object({
  id: z.string().min(1),
  /** Chapter id such as "c3" or "postgame". */
  chapterId: z.string().min(1),
  /** Optional section of that chapter this step belongs to. */
  sectionId: z.string().optional(),
  title: z.string().max(200),
  /** Free text shown as written (not interpreted as markup). */
  notes: z.string().max(20000),
  checklist: z.array(walkthroughItem).max(200),
});

export const walkthrough = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  steps: z.array(walkthroughStep).max(500),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type WalkthroughItem = z.infer<typeof walkthroughItem>;
export type WalkthroughStep = z.infer<typeof walkthroughStep>;
export type Walkthrough = z.infer<typeof walkthrough>;

/** Check ids stored in the profile's `checks`. */
export const stepDoneId = (wid: string, sid: string) => `wt:${wid}:${sid}`;
export const itemDoneId = (wid: string, sid: string, iid: string) => `wt:${wid}:${sid}:${iid}`;

export function newItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyStep(chapterId = "c1"): WalkthroughStep {
  return { id: newItemId(), chapterId, title: "", notes: "", checklist: [] };
}

export function emptyWalkthrough(title: string, now = Date.now()): Walkthrough {
  return {
    id: `wt-${now.toString(36)}-${newItemId()}`,
    title,
    steps: [emptyStep()],
    createdAt: now,
    updatedAt: now,
  };
}

export function walkthroughProgress(w: Walkthrough, checks: Record<string, true>) {
  let done = 0;
  let total = 0;
  for (const s of w.steps) {
    total += 1 + s.checklist.length;
    if (checks[stepDoneId(w.id, s.id)]) done++;
    for (const i of s.checklist) if (checks[itemDoneId(w.id, s.id, i.id)]) done++;
  }
  return { done, total };
}
