// Sphere templates: weapons prepared on the side (acquired, levelled, filled with items) purely to be
// spectrumized onto the main weapon. Generated per option set (chapter limit, SP bonus) and cached.
import { STAT_KEYS, type Stats } from "@/data/weapons-schema";
import { MIN_SPHERE_LEVEL, sphereFromWeapon, type WeaponState } from "@/lib/weapons/mechanics";
import { itemCandidates, type ItemFilter } from "./candidates";
import { simulateRecipe, type SimOptions } from "./simulate";
import { acquisitionOptions, getWeapon, weaponData, type SynthSource } from "./sources";
import { solveChain, type Template } from "./solve";
import type { Acquire, Recipe, Stage } from "./types";

export const SPHERE_LEVELS = [5, 7, 10, 14];
const priceOf = (a: Acquire) => (a.kind === "shop" ? a.price : a.kind === "invent" ? a.gilda : 0);
const chapterOf = (a: Acquire) => (a.kind === "have" ? 1 : a.chapter);

export interface TemplateOptions extends ItemFilter, SimOptions {
  /** Longest chain (in build-ups) used when a sphere weapon is itself built up from a cheaper one. */
  maxAuxBuildUps?: number;
}

/** Cheapest acquisition available by `maxChapter`. */
function cheapestAcquire(weaponId: string, maxChapter: number): Acquire | undefined {
  return acquisitionOptions(weaponId)
    .filter((a) => chapterOf(a) <= maxChapter)
    .sort((a, b) => priceOf(a) - priceOf(b) || chapterOf(a) - chapterOf(b))[0];
}

type FillMode = "none" | "best" | "cheap";

/** Greedy fill of leftover SP with the items that add the most stat points (respecting weapon caps). */
function fillItems(state: WeaponState, weaponId: string, items: SynthSource[], mode: FillMode) {
  if (mode === "none") return [];
  const w = getWeapon(weaponId);
  const cur: Stats = { ...state.stats };
  const pool = mode === "cheap" ? items.filter((i) => (i.price ?? 0) <= 60) : items;
  const counts = new Map<string, number>();
  for (let sp = state.sp; sp > 0; sp--) {
    let best: SynthSource | undefined;
    let bestGain = 0;
    for (const it of pool) {
      let gain = 0;
      for (const k of STAT_KEYS)
        gain += Math.max(0, Math.min(it.gains[k] ?? 0, w.maxStats[k] - cur[k]));
      if (gain > bestGain || (gain === bestGain && best && (it.price ?? 0) < (best.price ?? 0))) {
        best = it;
        bestGain = gain;
      }
    }
    if (!best || bestGain === 0) break;
    for (const k of STAT_KEYS) cur[k] = Math.min(cur[k] + (best.gains[k] ?? 0), w.maxStats[k]);
    counts.set(best.name, (counts.get(best.name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ kind: "item" as const, name, count }));
}

function makeTemplate(
  id: string,
  recipe: Recipe,
  chapter: number,
  opts: SimOptions,
): Template | undefined {
  const sim = simulateRecipe(recipe, opts);
  if (sim.errors.length) return undefined;
  const sphere = sphereFromWeapon(sim.state, Number.MAX_SAFE_INTEGER);
  return {
    id,
    recipe,
    weaponId: sim.state.weaponId,
    level: sim.state.level,
    gains: { ...sphere.gains, du: undefined } as Template["gains"],
    abs: sim.cost.abs,
    gilda: sim.cost.gilda,
    chapter,
  };
}

/** a dominates b: no worse everywhere and strictly better somewhere. */
function dominates(a: Template, b: Template) {
  if (a.abs > b.abs || a.gilda > b.gilda || a.level > b.level) return false;
  let strict = a.abs < b.abs || a.gilda < b.gilda || a.level < b.level;
  for (const k of STAT_KEYS) {
    const ga = a.gains[k] ?? 0;
    const gb = b.gains[k] ?? 0;
    if (ga < gb) return false;
    if (ga > gb) strict = true;
  }
  return strict;
}

export function pareto(templates: Template[]): Template[] {
  return templates.filter((t) => !templates.some((o) => o !== t && dominates(o, t)));
}

const cache = new Map<string, Promise<Template[]>>();

export function generateTemplates(opts: TemplateOptions): Promise<Template[]> {
  const key = JSON.stringify([
    opts.maxChapter,
    !!opts.allowFound,
    opts.spBonus,
    opts.maxAuxBuildUps ?? 0,
  ]);
  const hit = cache.get(key);
  if (hit) return hit;
  const promise = buildTemplates(opts);
  cache.set(key, promise);
  return promise;
}

async function buildTemplates(opts: TemplateOptions): Promise<Template[]> {
  const items = itemCandidates(opts);
  const out: Template[] = [];
  const itemChapter = (name: string) => items.find((i) => i.name === name)?.fromChapter ?? 1;

  for (const w of weaponData.weapons) {
    const acquire = cheapestAcquire(w.id, opts.maxChapter);
    if (!acquire) continue;
    for (const level of SPHERE_LEVELS) {
      for (const mode of ["none", "best", "cheap"] as FillMode[]) {
        const base: Recipe = { acquire, stages: [{ weaponId: w.id, levelTo: level, synths: [] }] };
        const lvl = simulateRecipe(base, opts);
        const synths = fillItems(lvl.state, w.id, items, mode);
        const stage: Stage = { weaponId: w.id, levelTo: level, synths };
        const chapter = Math.max(chapterOf(acquire), ...synths.map((s) => itemChapter(s.name)));
        const t = makeTemplate(
          `${w.id}+${level}:${mode}`,
          { acquire, stages: [stage] },
          chapter,
          opts,
        );
        if (t) out.push(t);
      }
    }
  }

  // Sphere weapons that are cheap to reach by building up a cheaper acquirable weapon (e.g. True Battle Wrench).
  const maxBuildUps = opts.maxAuxBuildUps ?? 2;
  if (maxBuildUps > 0) out.push(...(await chainedTemplates(opts, items, maxBuildUps)));

  return pareto(out);
}

function chainsTo(targetId: string, maxBuildUps: number): string[][] {
  // Walk build-up edges backwards from the target.
  const parents = new Map<string, string[]>();
  for (const w of weaponData.weapons)
    for (const t of w.buildsUpTo) parents.set(t, [...(parents.get(t) ?? []), w.id]);
  const chains: string[][] = [];
  const walk = (id: string, path: string[]) => {
    if (path.length > 1) chains.push(path);
    if (path.length > maxBuildUps) return;
    for (const p of parents.get(id) ?? []) walk(p, [p, ...path]);
  };
  walk(targetId, [targetId]);
  return chains;
}

async function chainedTemplates(
  opts: TemplateOptions,
  items: SynthSource[],
  maxBuildUps: number,
): Promise<Template[]> {
  const out: Template[] = [];
  for (const target of weaponData.weapons) {
    // Only weapons that are themselves cheap to level are worth building as spheres.
    if (target.baseAbs > 160) continue;
    for (const chain of chainsTo(target.id, maxBuildUps)) {
      const acquire = cheapestAcquire(chain[0], opts.maxChapter);
      if (!acquire) continue;
      // Solve the cheapest way to reach the chain's last weapon once, then extend the final level.
      const sol = await solveChain({
        start: freshOf(chain[0]),
        chain,
        objective: "abs",
        spBonus: opts.spBonus,
        items,
        templates: [],
        finalLevel: MIN_SPHERE_LEVEL,
        maxLevel: 20,
        timeLimitSec: 2,
      });
      if (!sol.plan) continue;
      for (const level of SPHERE_LEVELS) {
        const last = sol.plan.stages[sol.plan.stages.length - 1];
        if (level < last.levelTo) continue;
        const reached: Recipe = {
          acquire,
          stages: sol.plan.stages.map((s) => (s === last ? { ...s, levelTo: level } : s)),
        };
        const lvl = simulateRecipe(reached, opts);
        if (lvl.errors.length) continue;
        for (const mode of ["none", "best", "cheap"] as FillMode[]) {
          const stages = reached.stages.map((s) =>
            s === reached.stages[reached.stages.length - 1]
              ? { ...s, synths: [...s.synths, ...fillItems(lvl.state, s.weaponId, items, mode)] }
              : s,
          );
          const used = stages.flatMap((s) => s.synths).filter((s) => s.kind === "item");
          const chapter = Math.max(
            chapterOf(acquire),
            ...used.map(
              (s) => items.find((i) => i.name === (s as { name: string }).name)?.fromChapter ?? 1,
            ),
          );
          const t = makeTemplate(
            `${chain.join(">")}+${level}:${mode}`,
            { acquire, stages },
            chapter,
            opts,
          );
          if (t) out.push(t);
        }
      }
    }
  }
  return out;
}

import { freshState } from "@/lib/weapons/mechanics";
const freshOf = (id: string) => freshState(getWeapon(id));
