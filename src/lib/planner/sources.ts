import weaponsRaw from "@/data/weapons.json";
import itemsRaw from "@/data/items.json";
import { weaponsData, type AbilityId, type SynthItem, type Weapon } from "@/lib/schemas";
import { checklist } from "@/lib/data";
import type { Acquire } from "./types";

export const weaponData = weaponsData.parse(weaponsRaw);
export const weaponById = new Map<string, Weapon>(weaponData.weapons.map((w) => [w.id, w]));
export const getWeapon = (id: string): Weapon => {
  const w = weaponById.get(id);
  if (!w) throw new Error(`unknown weapon: ${id}`);
  return w;
};

interface ShopItem {
  name: string;
  price: number;
  fromChapter: number;
  shops: string[];
}
const shopItems = new Map<string, ShopItem>((itemsRaw as ShopItem[]).map((i) => [i.name, i]));

export interface SynthSource extends SynthItem {
  /** Gilda per item when sold in a shop; undefined when only found/dropped/invented. */
  price?: number;
  /** Earliest chapter it is sold; undefined when not sold. */
  fromChapter?: number;
  /** Coins add this ability instead of stats (opposites cancel). */
  ability?: AbilityId;
}

/** Coins and the ability each one carries (weapon FAQ 4.2). */
export const COIN_ABILITIES: Record<string, AbilityId> = {
  "Wealth Coin": "wealth",
  "Indestructible Coin": "durable",
  "Poison Coin": "poison",
  "Time Coin": "stop",
  "Bandit Coin": "steal",
  "Absorption Coin": "absorb",
  "Healing Coin": "heal",
  "Bull's-Eye Coin": "critical",
  "Experience Coin": "abs-up",
  "Dark Coin": "dark",
};

const statSources: SynthSource[] = weaponData.synthItems.map((s) => {
  const shop = shopItems.get(s.name);
  return shop ? { ...s, price: shop.price, fromChapter: shop.fromChapter } : s;
});

const coinSources: SynthSource[] = Object.entries(COIN_ABILITIES).map(([name, ability]) => {
  const shop = shopItems.get(name);
  return {
    name,
    category: "Coins",
    gains: {},
    ability,
    ...(shop ? { price: shop.price, fromChapter: shop.fromChapter } : {}),
  };
});

export const synthSources: SynthSource[] = [...statSources, ...coinSources];

export type ItemAvailability =
  | { kind: "buyable"; price: number; fromChapter: number; shops: string[] }
  | { kind: "found" };

/**
 * Whether a synth item can be bought. Items without a price are found-only (dungeon chests, drops, fishing,
 * inventions). The chapter is the first chapter a shop *stocks* it; neither guide says when the item shops
 * themselves open, so for item shops it is approximate (see src/data/INCONSISTENCIES.md, section 4).
 */
export function itemAvailability(name: string): ItemAvailability {
  const shop = shopItems.get(name);
  return shop
    ? { kind: "buyable", price: shop.price, fromChapter: shop.fromChapter, shops: shop.shops }
    : { kind: "found" };
}
export const coinFor = (ability: AbilityId) => coinSources.find((c) => c.ability === ability);
export const synthSourceByName = new Map(synthSources.map((s) => [s.name, s]));

/** Chapter in which an idea or scoop (invention ingredient) first becomes available. */
const ingredientChapter = new Map<string, number>();
for (const i of checklist) {
  if (i.category !== "idea" && i.category !== "scoop") continue;
  const n = Number(i.chapterId.replace("c", ""));
  if (Number.isFinite(n)) ingredientChapter.set(i.name.toLowerCase(), n);
}

/** Cheapest reliable ways to obtain a weapon at +0 (shop or invention). Dungeon/event drops are excluded. */
export function acquisitionOptions(weaponId: string): Acquire[] {
  const out: Acquire[] = [];
  const shops = weaponData.shops.filter((s) => s.weaponId === weaponId);
  const cheapest = new Map<string, { shop: string; price: number; chapter: number }>();
  for (const s of shops) {
    const key = s.shop;
    const cur = cheapest.get(key);
    if (!cur || s.chapter < cur.chapter)
      cheapest.set(key, { shop: s.shop, price: s.price, chapter: s.chapter });
  }
  for (const v of cheapest.values()) out.push({ kind: "shop", ...v });

  const inv = weaponData.invented.find((i) => i.weaponId === weaponId);
  if (inv) {
    let gilda = 0;
    let chapter = 1;
    for (const m of inv.materials) {
      const p = shopItems.get(m.name);
      gilda += (p?.price ?? 0) * m.qty;
      chapter = Math.max(chapter, p?.fromChapter ?? 1);
    }
    for (const alts of inv.ideas) {
      // With "A OR B" alternatives, the earliest available one counts.
      const chapters = alts.map((a) => ingredientChapter.get(a.toLowerCase()) ?? 8);
      chapter = Math.max(chapter, Math.min(...chapters));
    }
    out.push({ kind: "invent", chapter, gilda });
  }
  return out;
}
