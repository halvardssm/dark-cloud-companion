// Pure game mechanics for weapon leveling, synthing and building up.
// Formulas follow the weapon FAQ (sections 4.1–4.5). No React or DOM here.
import {
  STAT_KEYS,
  type AbilityId,
  type StatKey,
  type Stats,
  type Weapon,
} from "@/data/weapons-schema";

export const MAX_LEVEL = 99;
export const MAX_SP = 999;
/** Spectrumizing keeps this share of every stat except At (and Du, which is kept at the same rate). */
export const SPECTRUMIZE_KEEP = 0.6;
/** Spectrumizing a weapon below this level yields an unstable, near-useless sphere. */
export const MIN_SPHERE_LEVEL = 5;

export const OPPOSITES: Partial<Record<AbilityId, AbilityId>> = {
  wealth: "poverty",
  poverty: "wealth",
  critical: "dark",
  dark: "critical",
  durable: "fragile",
  fragile: "durable",
  absorb: "heal",
  heal: "absorb",
};

export interface WeaponState {
  weaponId: string;
  level: number;
  /** ABS already stored toward the next level. */
  abs: number;
  stats: Stats;
  du: number;
  sp: number;
  abilities: AbilityId[];
}

export const emptyStats = (): Stats => Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Stats;

/** A fresh weapon exactly as bought or found: base stats, +0. */
export function freshState(w: Weapon): WeaponState {
  return {
    weaponId: w.id,
    level: 0,
    abs: 0,
    stats: { ...w.baseStats },
    du: 0,
    sp: w.baseSp,
    abilities: [...w.abilities],
  };
}

// ---------- ABS ----------

/** ABS needed to go from +N to +(N+1), where B is the weapon's base ABS requirement. */
export const absForNextLevel = (base: number, level: number) =>
  base + (Math.max(level, 1) - 1) * (base / 2);

/** Total ABS needed to reach +N from +0. */
export const absToReach = (base: number, level: number) =>
  level <= 0 ? 0 : base + ((level * (level + 1)) / 2 - 1) * (base / 2);

export const absBetween = (base: number, from: number, to: number) =>
  absToReach(base, to) - absToReach(base, from);

// ---------- abilities ----------

/** Adding an ability cancels its opposite instead; abilities without opposites don't stack. */
export function addAbility(current: AbilityId[], ability: AbilityId): AbilityId[] {
  const opposite = OPPOSITES[ability];
  if (opposite && current.includes(opposite)) return current.filter((a) => a !== opposite);
  return current.includes(ability) ? current : [...current, ability];
}

export const addAbilities = (current: AbilityId[], abilities: AbilityId[]) =>
  abilities.reduce(addAbility, current);

// ---------- leveling ----------

/** At gained on level-up: +2 (or +3 for weapons with kill requirements) for the first five levels, then +1. */
export function attackPerLevel(weapon: Weapon, levelBefore: number): number {
  if (levelBefore >= 5) return 1;
  return weapon.requiresKills.length > 0 ? 3 : 2;
}

/** Applies one level-up. `spBonus` is +1 with the matching support character (Cedric/Gerald/Milane/Lin). */
export function levelUp(state: WeaponState, weapon: Weapon, spBonus = 0): WeaponState {
  if (state.level >= MAX_LEVEL) return state;
  const stats = { ...state.stats };
  stats.at = Math.min(stats.at + attackPerLevel(weapon, state.level), weapon.maxStats.at);
  return {
    ...state,
    level: state.level + 1,
    abs: 0,
    stats,
    du: Math.min(state.du + 1, weapon.maxDu),
    sp: Math.min(state.sp + weapon.spPerLevel + spBonus, MAX_SP),
  };
}

export function levelUpTo(
  state: WeaponState,
  weapon: Weapon,
  level: number,
  spBonus = 0,
): WeaponState {
  let s = state;
  while (s.level < Math.min(level, MAX_LEVEL)) s = levelUp(s, weapon, spBonus);
  return s;
}

// ---------- synth ----------

const capStats = (stats: Stats, weapon: Weapon): Stats =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, Math.min(stats[k], weapon.maxStats[k])])) as Stats;

/** Stats a spectrumized weapon contributes. At depends on the receiving weapon's At (FAQ 4.3). */
export function sphereFromWeapon(
  aux: WeaponState,
  targetAt: number,
): { gains: Partial<Stats>; du: number; sp: number } {
  const gains: Partial<Stats> = {};
  for (const k of STAT_KEYS) {
    gains[k] =
      k === "at"
        ? attackTransfer(targetAt, aux.stats.at)
        : Math.floor(SPECTRUMIZE_KEEP * aux.stats[k]);
  }
  return { gains, du: Math.floor(SPECTRUMIZE_KEEP * aux.du), sp: aux.level };
}

export function attackTransfer(mainAt: number, auxAt: number): number {
  return mainAt >= auxAt
    ? Math.floor(0.25 * auxAt)
    : Math.floor(0.25 * auxAt + 0.75 * (auxAt - mainAt));
}

/** Synths a sphere onto a weapon. Costs `spCost` SP; does nothing if there isn't enough SP. */
export function synth(
  state: WeaponState,
  weapon: Weapon,
  gains: Partial<Stats> & { du?: number },
  spCost: number,
  abilities: AbilityId[] = [],
): WeaponState {
  if (state.sp < spCost) return state;
  const stats = { ...state.stats };
  for (const k of STAT_KEYS) stats[k] += gains[k] ?? 0;
  return {
    ...state,
    stats: capStats(stats, weapon),
    du: Math.min(state.du + (gains.du ?? 0), weapon.maxDu),
    sp: state.sp - spCost,
    abilities: addAbilities(state.abilities, abilities),
  };
}

// ---------- build-up ----------

/** X = floor(10% of the target weapon's base stat). */
export const buildUpBonus = (base: number) => Math.floor(0.1 * base);

/** Minimum stat on the current weapon for each stat to build up into `target`. */
export function buildUpRequirements(target: Weapon): Stats {
  return Object.fromEntries(
    STAT_KEYS.map((k) => [k, target.baseStats[k] - buildUpBonus(target.baseStats[k])]),
  ) as Stats;
}

export function statShortfalls(stats: Stats, target: Weapon): Partial<Record<StatKey, number>> {
  const req = buildUpRequirements(target);
  const out: Partial<Record<StatKey, number>> = {};
  for (const k of STAT_KEYS) if (stats[k] < req[k]) out[k] = req[k] - stats[k];
  return out;
}

export function canBuildUp(
  state: WeaponState,
  current: Weapon,
  target: Weapon,
  killed: ReadonlySet<string>,
): boolean {
  if (!current.buildsUpTo.includes(target.id)) return false;
  if (!target.requiresKills.every((e) => killed.has(e))) return false;
  return Object.keys(statShortfalls(state.stats, target)).length === 0;
}

/** Build up: each stat gets +10% of the target's base, level resets, abilities merge with cancellation. */
export function buildUp(state: WeaponState, target: Weapon): WeaponState {
  const stats = { ...state.stats };
  for (const k of STAT_KEYS) stats[k] += buildUpBonus(target.baseStats[k]);
  return {
    ...state,
    weaponId: target.id,
    level: 0,
    abs: 0,
    stats: capStats(stats, target),
    du: Math.min(state.du, target.maxDu),
    abilities: addAbilities(state.abilities, target.abilities),
  };
}
