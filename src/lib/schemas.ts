// Zod schemas and TypeScript types for the static game data (the JSON files in src/data/).
// One module for all of it: chapters/sections/checklists, weapons, gamedata (inventions,
// Georama, shops, items, fishing) and minigames (Ridepod, monsters).
import { z } from "zod";

// ---------- chapters, sections and checklist items ----------

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

// ---------- weapons ----------

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

// ---------- gamedata: inventions, Georama, shops, items, fishing ----------

const qty = z.object({ name: z.string(), qty: z.number().int() });
const ingredient = z.object({ name: z.string(), scoop: z.boolean() });

export const invention = z.object({
  name: z.string(),
  /** Chapter in which it can first be invented without the photo album. */
  chapter: z.number().int(),
  /** Where its recipe can be found, or null when unknown. */
  recipeFound: z.string().nullable(),
  ideas: z.array(ingredient),
  alternate: z.array(ingredient).optional(),
  components: z.array(qty),
  /** Overall gilda price of the components, when listed. */
  price: z.number().int().optional(),
});
export type Invention = z.infer<typeof invention>;

export const georamaPart = z.object({
  name: z.string(),
  /** Polygon-based score and culture points; absent for some later parts. */
  polyn: z.number().int().optional(),
  cp: z.number().int().optional(),
  components: z.array(qty),
  /** Gilda cost to buy every component from Conda, when listed. */
  cost: z.number().int().optional(),
  /** Geostone (section/area) that unlocks the part, or null when always available. */
  geostone: z.string().nullable(),
});

export const georamaArea = z.object({
  name: z.string(),
  tasks: z.array(
    z.object({
      name: z.string(),
      /** Share of the area's completion this task is worth. */
      percent: z.number().int(),
      conditions: z.array(z.string()),
    }),
  ),
  reward: z.string().optional(),
});

export const shop = z.object({
  name: z.string(),
  currency: z.enum(["gilda", "medals", "exp"]),
  items: z.array(
    z.object({
      name: z.string(),
      price: z.number().int().optional(),
      /** First chapter it is sold; absent means always. */
      chapter: z.number().int().optional(),
    }),
  ),
});

export const itemOverview = z.object({
  name: z.string(),
  category: z.enum(["functional", "clothing", "ridepod", "material", "coin"]),
  /** What the item does (functional items). */
  effect: z.string().optional(),
  /** Clothing: who wears it and where. */
  who: z.string().optional(),
  slot: z.string().optional(),
  /** Ridepod parts: slot, capacity and attack/armor/energy value as printed. */
  part: z.string().optional(),
  capacity: z.number().int().optional(),
  value: z.string().optional(),
  /** Synth gains as printed, e.g. { Fl: 2 }. Empty when it can't be synthed. */
  synth: z.record(z.string(), z.number()),
  /** Ability granted when synthed (coins). */
  ability: z.string().optional(),
});

export const fishing = z.object({
  baits: z.array(z.object({ name: z.string(), type: z.string(), fish: z.array(z.string()) })),
  lures: z.array(z.object({ name: z.string(), fish: z.array(z.string()) })),
  /** Donny's photography rewards by player level / points. */
  photoRewards: z.array(
    z.object({ level: z.number().int(), points: z.number().int(), reward: z.string() }),
  ),
});

export const gamedata = {
  inventions: z.array(invention),
  georamaParts: z.array(georamaPart),
  georamaAreas: z.array(georamaArea),
  shops: z.array(shop),
  items: z.array(itemOverview),
  fishing,
};

// ---------- minigames: Ridepod and monsters ----------

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
