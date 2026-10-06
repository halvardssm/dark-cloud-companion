// Resolves checklist entries that point at data items.
import { checklist, medalItems, sectionById, sections } from "@/lib/data";
import type { ChecklistItem, Section } from "@/lib/schemas";
import type { Entry } from "./types";

const itemById = new Map(checklist.map((i) => [i.id, i]));

export type ResolvedEntry =
  | { kind: "item"; ref: string; item: ChecklistItem }
  | { kind: "section"; ref: string; section: Section; medals: ReturnType<typeof medalItems> }
  | { kind: "missing"; ref: string };

export function resolveEntry(e: Extract<Entry, { kind: "item" | "section" }>): ResolvedEntry {
  if (e.kind === "item") {
    const item = itemById.get(e.ref);
    return item ? { kind: "item", ref: e.ref, item } : { kind: "missing", ref: e.ref };
  }
  const section = sectionById.get(e.ref);
  return section
    ? { kind: "section", ref: e.ref, section, medals: medalItems(section) }
    : { kind: "missing", ref: e.ref };
}

/** Tick ids an entry contributes to a step's progress. Text entries are per guide, references are global. */
export function entryTickIds(guideId: string, stepId: string, e: Entry): string[] {
  if (e.kind === "text") return [`g:${guideId}:${stepId}:${e.id}`];
  const r = resolveEntry(e);
  if (r.kind === "item") return [r.item.id];
  if (r.kind === "section") return r.medals.map((m) => m.id);
  return [];
}

export const knownItemIds = new Set(itemById.keys());
export const knownSectionIds = new Set(sections.map((s) => s.id));
