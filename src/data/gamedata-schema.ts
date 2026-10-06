import { z } from "zod";

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
