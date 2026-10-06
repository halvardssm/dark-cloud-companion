import { z } from "zod";

export const STAT_KEYS = ["at", "fl", "ch", "li", "cy", "sm", "ex", "be", "sc"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

const statValue = z.number().int().min(0);
export const stats = z.object(
  Object.fromEntries(STAT_KEYS.map((k) => [k, statValue])) as Record<StatKey, typeof statValue>,
);
export type Stats = z.infer<typeof stats>;

export const abilityId = z.enum([
  "wealth",
  "poverty",
  "poison",
  "stop",
  "steal",
  "critical",
  "durable",
  "fragile",
  "absorb",
  "heal",
  "dark",
  "abs-up",
]);
export type AbilityId = z.infer<typeof abilityId>;

export const weaponType = z.enum(["wrench", "club", "gun", "sword", "armband"]);
export type WeaponType = z.infer<typeof weaponType>;

export const weapon = z.object({
  id: z.string(),
  name: z.string(),
  character: z.enum(["max", "monica"]),
  type: weaponType,
  /** Gun damage type: N normal, M machine gun, G grenade, B beam. */
  gunType: z.enum(["N", "M", "G", "B"]).optional(),
  /** Combo length as printed in the source (e.g. "5", "5F" fast, "5b" variant). */
  combo: z.string().optional(),
  /** In-game item description (from the walkthrough's weapon list). */
  description: z.string().optional(),
  /** Attack changes with time of day (Lamb's Sword). */
  attackVariesByTime: z.boolean().optional(),
  /** ABS needed to reach +1 (B in the ABS formulas). May be .5 for some guns. */
  baseAbs: z.number(),
  /** SP gained per level (3 low / 4 mid / 6 high tier). */
  spPerLevel: z.number().int(),
  abilities: z.array(abilityId),
  /** Weapon ids this weapon can build up to. */
  buildsUpTo: z.array(z.string()),
  /** Enemy types that must have been killed before building up *to* this weapon. */
  requiresKills: z.array(z.string()),
  baseStats: stats,
  baseSp: z.number().int(),
  maxStats: stats,
  maxDu: z.number().int(),
});
export type Weapon = z.infer<typeof weapon>;

export const synthItem = z.object({
  name: z.string(),
  category: z.string(),
  /** Stat points gained when spectrumized; du is durability. */
  gains: stats.partial().extend({ du: statValue.optional() }),
});
export type SynthItem = z.infer<typeof synthItem>;

export const shopEntry = z.object({
  chapter: z.number().int(),
  shop: z.string(),
  weaponId: z.string(),
  price: z.number().int(),
});

export const inventedWeapon = z.object({
  weaponId: z.string(),
  /** Three ideas/scoops; inner arrays are alternatives ("A OR B"). */
  ideas: z.array(z.array(z.string())),
  materials: z.array(z.object({ name: z.string(), qty: z.number().int() })),
});

export const eventWeapon = z.object({
  weaponId: z.string(),
  how: z.string(),
});

export const killRequirementEnemy = z.object({
  name: z.string(),
  /** Chapter where the enemy first appears, when the guide says so. */
  chapter: z.number().int().optional(),
});

export const weaponsData = z.object({
  weapons: z.array(weapon),
  synthItems: z.array(synthItem),
  shops: z.array(shopEntry),
  invented: z.array(inventedWeapon),
  events: z.array(eventWeapon),
  dungeonWeapons: z.array(z.object({ dungeon: z.string(), weaponIds: z.array(z.string()) })),
  killEnemies: z.array(killRequirementEnemy),
});
export type WeaponsData = z.infer<typeof weaponsData>;
