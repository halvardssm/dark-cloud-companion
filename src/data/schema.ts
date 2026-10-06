import { z } from "zod";

export const checklistCategory = z.enum([
  "scoop",
  "idea",
  "invention",
  "powerup",
  "recruit",
  "georama",
  "badge",
]);
export type ChecklistCategory = z.infer<typeof checklistCategory>;

export const recipePart = z.object({
  name: z.string(),
  /** Needs a scoop photo (marked with * in the source). */
  scoop: z.boolean(),
});

export const checklistItem = z.object({
  id: z.string(),
  chapterId: z.string(),
  category: checklistCategory,
  name: z.string(),
  missable: z.boolean(),
  postgame: z.boolean(),
  /** Scoop is a ghost photo (take at night). */
  ghost: z.boolean().optional(),
  /** Only obtainable via the photo album, not in-game. */
  albumOnly: z.boolean().optional(),
  /** Section where the item becomes available. */
  sectionId: z.string().optional(),
  recipe: z.array(recipePart).optional(),
  /** Extra qualifiers (location, condition). Source wording is paraphrased only where noted. */
  notes: z.array(z.string()).optional(),
});
export type ChecklistItem = z.infer<typeof checklistItem>;

export const medals = z.object({
  timeAttack: z.string().optional(),
  fishingGoal: z.string().optional(),
  clearGoal: z.string().optional(),
  prize: z.string().optional(),
  prizeType: z.enum(["spheda", "other"]).optional(),
});

export const section = z.object({
  id: z.string(),
  chapterId: z.string(),
  code: z.string(),
  title: z.string(),
  kind: z.enum(["story", "interlude", "dungeon", "boss"]),
  order: z.number().int(),
  medals: medals.optional(),
  enemies: z.array(
    z.object({ name: z.string(), count: z.number().int(), carriesKey: z.boolean() }),
  ),
  totals: z.object({ abs: z.number().int(), gilda: z.number().int() }).optional(),
  geostone: z.string().optional(),
  seal: z.string().optional(),
  newPhotos: z.array(z.string()),
  newScoops: z.array(z.string()),
  newInventions: z.array(z.object({ name: z.string(), recipe: z.array(recipePart) })),
  /** Boss fought in this section (from the "Boss:" line); `scoop` when it can be photographed. */
  boss: z.object({ name: z.string(), scoop: z.boolean() }).optional(),
  /** Restriction line such as "Ridepod only". */
  special: z.string().optional(),
  /** Scoops the guide marks for this section; `onlyChance` when it can't be retaken. */
  scoopNotes: z.array(z.object({ name: z.string(), onlyChance: z.boolean() })),
  /** Running photo totals after this section, as printed by the source. */
  photoCount: z
    .object({
      ideas: z.number().int(),
      scoops: z.number().int(),
      level: z.number().int().optional(),
      points: z.number().int().optional(),
    })
    .optional(),
  /** Georama parts the guide says to build in this section ("build the following" lists). */
  georamaBuild: z.array(z.object({ name: z.string(), qty: z.number().int() })),
  /** Characters recruited here and where they can be found. */
  recruits: z.array(z.object({ name: z.string(), location: z.string() })),
});
export type Section = z.infer<typeof section>;

export const chapter = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  phase: z.enum(["main", "postgame"]),
  seals: z.array(z.string()),
  sectionIds: z.array(z.string()),
  /** Party stats and photo totals at the end of the chapter. */
  endStats: z
    .object({
      maxHp: z.number().int(),
      maxDef: z.number().int(),
      monicaHp: z.number().int(),
      monicaDef: z.number().int(),
      ideas: z.number().int(),
      scoops: z.number().int(),
      inventions: z.number().int(),
      level: z.number().int(),
      points: z.number().int(),
    })
    .optional(),
});
export type Chapter = z.infer<typeof chapter>;

export const chaptersFile = z.array(chapter);
export const sectionsFile = z.array(section);
export const checklistFile = z.array(checklistItem);
