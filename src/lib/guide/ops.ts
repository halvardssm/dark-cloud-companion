import { newId, type Guide, type Step } from "./types";

export const newGuideId = () => `g-${Date.now().toString(36)}-${newId()}`;

/** A custom copy of any guide (built-in guides are read-only; copying is how you edit them). */
export function duplicateGuide(g: Guide, title = `${g.title} (copy)`): Guide {
  const now = Date.now();
  return {
    ...structuredClone(g),
    id: newGuideId(),
    title,
    kind: "custom",
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyStep(chapterId?: string): Step {
  return { id: newId(), title: "", notes: "", ...(chapterId ? { chapterId } : {}), entries: [] };
}

export function emptyGuide(title: string): Guide {
  const now = Date.now();
  return {
    id: newGuideId(),
    title,
    kind: "custom",
    steps: [emptyStep()],
    createdAt: now,
    updatedAt: now,
  };
}

/** Groups step positions by chapter id (undefined = anytime), keeping each group in guide order. */
export function groupByChapter(
  steps: Step[],
): Map<string | undefined, { step: Step; index: number }[]> {
  const groups = new Map<string | undefined, { step: Step; index: number }[]>();
  steps.forEach((step, index) => {
    const list = groups.get(step.chapterId) ?? [];
    list.push({ step, index });
    groups.set(step.chapterId, list);
  });
  return groups;
}
