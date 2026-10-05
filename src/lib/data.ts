import chaptersJson from "@/data/chapters.json";
import sectionsJson from "@/data/sections.json";
import checklistJson from "@/data/checklist.json";
import { chaptersFile, checklistFile, sectionsFile } from "@/data/schema";
import type { Chapter, ChecklistItem, Section } from "@/data/schema";

export const chapters: Chapter[] = chaptersFile.parse(chaptersJson);
export const sections: Section[] = sectionsFile.parse(sectionsJson);
export const checklist: ChecklistItem[] = checklistFile.parse(checklistJson);

export const chapterById = new Map(chapters.map((c) => [c.id, c]));
export const sectionById = new Map(sections.map((s) => [s.id, s]));

export const sectionsOf = (chapterId: string) => sections.filter((s) => s.chapterId === chapterId);
export const itemsOf = (chapterId: string) => checklist.filter((i) => i.chapterId === chapterId);

/** Item lookup by lowercased name for ideas and scoops (recipe ingredients). */
export const ingredientIdByName = new Map(
  checklist
    .filter((i) => i.category === "idea" || i.category === "scoop")
    .map((i) => [i.name.toLowerCase(), i.id]),
);

export type MedalKind = "timeAttack" | "fishingGoal" | "clearGoal" | "prize";

export interface MedalItem {
  id: string;
  sectionId: string;
  kind: MedalKind;
  /** Target value from the source data (time, length, restriction, or prize name). */
  value: string;
  prizeType?: "spheda" | "other";
}

const medalKinds: MedalKind[] = ["timeAttack", "fishingGoal", "clearGoal", "prize"];

/** Medals/prizes are derived from section data rather than stored as checklist items. */
export function medalItems(section: Section): MedalItem[] {
  const m = section.medals;
  if (!m) return [];
  return medalKinds.flatMap((kind) => {
    const value = m[kind];
    return value
      ? [
          {
            id: `${section.id}:${kind}`,
            sectionId: section.id,
            kind,
            value,
            prizeType: kind === "prize" ? m.prizeType : undefined,
          },
        ]
      : [];
  });
}

export const allMedals = sections.flatMap(medalItems);

/** An invention is buildable once every ingredient (idea or scoop) is checked. */
export function inventionReady(item: ChecklistItem, checks: Record<string, true>): boolean {
  return (item.recipe ?? []).every((r) => {
    const id = ingredientIdByName.get(r.name.toLowerCase());
    return id ? !!checks[id] : false;
  });
}

export interface Progress {
  done: number;
  total: number;
}

export function chapterProgress(chapterId: string, checks: Record<string, true>): Progress {
  const ids = [
    ...itemsOf(chapterId).map((i) => i.id),
    ...sectionsOf(chapterId)
      .flatMap(medalItems)
      .map((m) => m.id),
  ];
  return { done: ids.filter((id) => checks[id]).length, total: ids.length };
}
