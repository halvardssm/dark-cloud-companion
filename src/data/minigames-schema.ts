import { z } from "zod";

const ingredient = z.object({ name: z.string(), scoop: z.boolean() });

export const ridepodPart = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["short", "long", "armor", "legs", "pack"]),
  /** Exp price when the part can be bought; absent when invention-only. */
  buyExp: z.number().int().optional(),
  capacity: z.number().int(),
  /** Category-specific main figure: WHP (weapons), armor, speed (legs, as printed) or energy (packs). */
  whp: z.number().int().optional(),
  armor: z.number().int().optional(),
  speed: z.string().optional(),
  energy: z.number().int().optional(),
  /** Three ideas/scoops to invent it. */
  invent: z.array(ingredient),
  alternate: z.array(ingredient).optional(),
  resources: z.array(z.object({ name: z.string(), qty: z.number().int() })),
  /** Attack and element stats for weapons, keyed by stat name as printed. */
  stats: z.record(z.string(), z.number()).optional(),
});
export type RidepodPart = z.infer<typeof ridepodPart>;

export const ridepodData = z.object({
  parts: z.array(ridepodPart),
  cores: z.array(
    z.object({
      name: z.string(),
      exp: z.number().int(),
      capacity: z.number().int(),
      armor: z.number().int(),
    }),
  ),
  shieldKitCosts: z.array(z.number().int()),
});

export const monsterForm = z.object({
  name: z.string(),
  atk: z.number().int(),
  def: z.number().int(),
  evolvesTo: z.array(z.string()),
  /** Extra requirement printed in the source, e.g. "5 Rubies". */
  note: z.string().optional(),
  depth: z.number().int(),
});

export const monsterClass = z.object({
  id: z.string(),
  name: z.string(),
  /** How the badge is obtained (short factual phrase). */
  badge: z.string(),
  forms: z.array(monsterForm),
});

export const monstersData = z.array(monsterClass);
export type MonsterClass = z.infer<typeof monsterClass>;
