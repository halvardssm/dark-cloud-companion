// Unified guide model (D15). A guide is an ordered list of steps; a step may be pinned to a chapter/section,
// carries a checklist of entries, and may be one stage of a weapon build.
import { z } from "zod";
import { abilityId, STAT_KEYS, type StatKey } from "@/data/weapons-schema";
import type { Stage } from "@/lib/planner/types";

const stat = z.number().int().min(0).max(999);
const stats = z.object(
  Object.fromEntries(STAT_KEYS.map((k) => [k, stat])) as Record<StatKey, typeof stat>,
);

/** Free-text checklist line; ticked per guide. */
export const textEntry = z.object({
  kind: z.literal("text"),
  id: z.string().min(1),
  text: z.string().max(500),
});

/** Reference to a data item (collectable, Ridepod part, …); its tick is shared by every guide. */
export const itemEntry = z.object({
  kind: z.literal("item"),
  /** Id of the referenced item, e.g. a checklist item id. */
  ref: z.string().min(1),
});

/** Reference to a section: shows its facts and its medal/prize checkboxes. */
export const sectionEntry = z.object({
  kind: z.literal("section"),
  ref: z.string().min(1),
});

export const entry = z.discriminatedUnion("kind", [textEntry, itemEntry, sectionEntry]);
export type Entry = z.infer<typeof entry>;
export type TextEntry = z.infer<typeof textEntry>;

/** One stage of a weapon build (planner `Stage`); stats and costs are derived, never stored. */
const stage = z.custom<Stage>(
  (v) =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as Stage).weaponId === "string" &&
    typeof (v as Stage).levelTo === "number" &&
    Array.isArray((v as Stage).synths),
);

export const step = z.object({
  id: z.string().min(1),
  title: z.string().max(200),
  /** Free text shown as written (never interpreted as markup). */
  notes: z.string().max(20000),
  /** Optional placement: chapter id such as "c3" or "postgame", and a section of that chapter. */
  chapterId: z.string().optional(),
  sectionId: z.string().optional(),
  entries: z.array(entry).max(300),
  /** Present when this step is a stage of the guide's weapon build. */
  build: stage.optional(),
});
export type Step = z.infer<typeof step>;

/** Start state of a build: a weapon and its current specs. */
export const buildStart = z.object({
  weaponId: z.string(),
  level: z.number().int().min(0).max(99),
  abs: z.number().min(0),
  stats,
  du: z.number().int().min(0),
  sp: z.number().int().min(0).max(999),
  abilities: z.array(abilityId),
  /** Extra SP per level from the matching support character. */
  spBonus: z.number().int().min(0).max(1),
  /** How the start weapon is obtained (for the first line of a generated guide). */
  acquire: z
    .custom<import("@/lib/planner/types").Acquire>(
      (v) => typeof v === "object" && v !== null && "kind" in v,
    )
    .optional(),
});
export type BuildStart = z.infer<typeof buildStart>;

export const guide = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Built-in guides are generated and read-only; custom guides are the user's. */
  kind: z.enum(["builtin", "custom"]),
  /** Context for build steps (absent for guides without any). */
  build: buildStart.optional(),
  steps: z.array(step).max(1000),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});
export type Guide = z.infer<typeof guide>;

// ---------- ids for progress ----------

/** Tick id of a step (done) or of a text entry inside it. Item/section entries use the data item's own ids. */
export const stepTickId = (guideId: string, stepId: string) => `g:${guideId}:${stepId}`;
export const textTickId = (guideId: string, stepId: string, entryId: string) =>
  `g:${guideId}:${stepId}:${entryId}`;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
