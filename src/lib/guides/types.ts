import { z } from "zod";
import { STAT_KEYS, type StatKey } from "@/data/weapons-schema";
import type { Stage } from "@/lib/planner/types";

const statRecord = z.object(
  Object.fromEntries(STAT_KEYS.map((k) => [k, z.number()])) as Record<StatKey, z.ZodNumber>,
);

export const guideStep = z.object({
  id: z.string(),
  /** Earliest chapter in which every requirement of this step is available. */
  chapter: z.number().int(),
  /** The planner stage this step describes (structure is produced by our own planner). */
  stage: z.custom<Stage>(
    (v) => typeof v === "object" && v !== null && "weaponId" in v && "synths" in v,
  ),
  /** Weapon this stage builds up into, if any. */
  buildsUpTo: z.string().optional(),
  /** Stats after this stage's synths, and the requirements of the next weapon. */
  stats: statRecord,
  requirements: statRecord.optional(),
  level: z.number(),
  spLeft: z.number(),
  /** ABS spent levelling in this stage. */
  abs: z.number(),
});

export const guide = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["curated", "custom"]),
  /** Description of the settings it was generated with (e.g. "Least ABS · maxed stats · chapter 7"). */
  summary: z.string(),
  targetId: z.string(),
  /** Weapon the guide starts from and how to get it (omitted for custom guides started from your own weapon). */
  start: z
    .object({
      weaponId: z.string(),
      acquire: z.custom<import("@/lib/planner/types").Acquire>(
        (v) => typeof v === "object" && v !== null && "kind" in v,
      ),
    })
    .optional(),
  totals: z.object({ abs: z.number(), gilda: z.number(), steps: z.number() }),
  steps: z.array(guideStep),
  createdAt: z.number().optional(),
});

export type GuideStep = z.infer<typeof guideStep>;
export type Guide = z.infer<typeof guide>;
