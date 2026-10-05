// Top-level planner: enumerates build-up chains from the start weapon to the target, ranks them with the
// LP relaxation, solves the best few exactly, and verifies the winner with the rule-checking simulator.
import type { Stats } from "@/data/weapons-schema";
import type { WeaponState } from "@/lib/weapons/mechanics";
import { itemCandidates } from "./candidates";
import { simulatePlan, type SimOptions } from "./simulate";
import { solveChain, type Objective, type SolveResult } from "./solve";
import { getWeapon, weaponData } from "./sources";
import { generateTemplates } from "./templates";
import type { Cost, Plan, SimulationResult } from "./types";

export type Goal =
  | { kind: "reach" }
  | { kind: "max" }
  | { kind: "stats"; stats: Partial<Stats>; level?: number };

export interface PlanRequest {
  start: WeaponState;
  targetId: string;
  objective: Objective;
  goal: Goal;
  /** Content available up to and including this chapter (shops, items, enemy kills). */
  maxChapter: number;
  /** Extra SP per level from the matching support character. */
  spBonus: number;
  allowFound?: boolean;
  /** Optional cap on gilda spent on items and sphere weapons. */
  maxGilda?: number;
  /** Number of chains to solve exactly (the best by LP bound). */
  exactChains?: number;
  timeLimitSec?: number;
}

export interface ChainOutcome {
  chain: string[];
  cost?: Cost;
  /** LP lower bound used for ranking. */
  bound?: number;
  status: SolveResult["status"] | "skipped";
}

export interface PlanResult {
  status: "ok" | "no-path" | "infeasible";
  chain?: string[];
  plan?: Plan;
  simulation?: SimulationResult & { state: WeaponState };
  alternatives: ChainOutcome[];
  message?: string;
}

const enemyChapter = new Map(weaponData.killEnemies.map((e) => [e.name, e.chapter ?? 8]));

/** All build-up chains start→target whose kill requirements are reachable by `maxChapter`. */
export function findChains(
  startId: string,
  targetId: string,
  maxChapter: number,
  limit = 40,
): string[][] {
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    if (out.length >= limit) return;
    if (id === targetId) {
      out.push(path);
      return;
    }
    for (const next of getWeapon(id).buildsUpTo) {
      const w = getWeapon(next);
      if (!w.requiresKills.every((e) => (enemyChapter.get(e) ?? 8) <= maxChapter)) continue;
      walk(next, [...path, next]);
    }
  };
  walk(startId, [startId]);
  return out;
}

export async function planPath(req: PlanRequest): Promise<PlanResult> {
  const chains = findChains(req.start.weaponId, req.targetId, req.maxChapter);
  if (!chains.length)
    return {
      status: "no-path",
      alternatives: [],
      message: "No build-up path to that weapon with the available content.",
    };

  const target = getWeapon(req.targetId);
  const items = itemCandidates({ maxChapter: req.maxChapter, allowFound: req.allowFound });
  const templates = await generateTemplates({
    maxChapter: req.maxChapter,
    allowFound: req.allowFound,
    spBonus: req.spBonus,
  });
  const goalInputs =
    req.goal.kind === "max"
      ? { finalStats: target.maxStats }
      : req.goal.kind === "stats"
        ? { finalStats: req.goal.stats, finalLevel: req.goal.level ?? 0 }
        : {};
  const base = {
    start: req.start,
    objective: req.objective,
    spBonus: req.spBonus,
    items,
    templates,
    maxGilda: req.maxGilda,
    ...goalInputs,
  };
  const simOpts: SimOptions = { spBonus: req.spBonus };

  // Rank chains by the continuous relaxation, then solve the best few exactly.
  const ranked: ChainOutcome[] = [];
  for (const chain of chains) {
    const r = await solveChain({ ...base, chain, relax: true, timeLimitSec: 20 });
    ranked.push({ chain, bound: r.value, status: r.status === "optimal" ? "optimal" : r.status });
  }
  ranked.sort((a, b) => (a.bound ?? Infinity) - (b.bound ?? Infinity));

  let best: { chain: string[]; plan: Plan; simulation: PlanResult["simulation"] } | undefined;
  let bestKey = Infinity;
  const exact = req.exactChains ?? 2;
  for (const [i, o] of ranked.entries()) {
    if (o.bound === undefined || i >= exact) {
      o.status = o.bound === undefined ? o.status : "skipped";
      continue;
    }
    const r = await solveChain({ ...base, chain: o.chain, timeLimitSec: req.timeLimitSec ?? 30 });
    o.status = r.status;
    if (!r.plan) continue;
    const sim = simulatePlan(req.start, r.plan, simOpts);
    o.cost = sim.cost;
    if (sim.errors.length) continue;
    const primary =
      req.objective === "abs"
        ? sim.cost.abs
        : req.objective === "gilda"
          ? sim.cost.gilda
          : sim.cost.steps;
    const key = primary + 1e-3 * (req.objective === "abs" ? sim.cost.gilda : sim.cost.abs);
    if (key < bestKey) {
      bestKey = key;
      best = { chain: o.chain, plan: r.plan, simulation: sim };
    }
  }
  if (!best)
    return {
      status: "infeasible",
      alternatives: ranked,
      message: "No valid plan found within the available content.",
    };
  return { status: "ok", ...best, alternatives: ranked };
}

/** Earliest chapter by which any build-up chain to `targetId` becomes possible (kill requirements). */
export function earliestChapter(startId: string, targetId: string): number {
  for (let ch = 1; ch <= 8; ch++) if (findChains(startId, targetId, ch, 1).length) return ch;
  return 8;
}
