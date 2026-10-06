// Stage optimiser: given a build-up chain, picks level-ups, synth items and sphere weapons that
// satisfy every build-up requirement at minimum cost, as a mixed-integer linear program (HiGHS).
//
// Model (per stage j, weapon w_j, stat k):
//   e[j][k]  = effective stat at the end of stage j (only ever feeds ≥ constraints, so "≤ growth" is safe)
//   e[j][k] ≤ e[j-1][k] + X[j][k] + Σ item gains + Σ sphere gains + level-up At        (growth)
//   e[j][k] ≤ cap(w_j, k)                                                              (weapon cap)
//   e[j][k] ≥ requirement of the next weapon                                           (build-up gate)
//   Σ SP gained from levelling (cumulative) ≥ Σ SP spent on items/spheres (cumulative)
// ABS for levelling is the exact convex cost curve, linearised with secants (tight at integers).
import { STAT_KEYS, type StatKey, type Stats } from "@/data/weapons-schema";
import {
  absBetween,
  buildUpBonus,
  buildUpRequirements,
  type WeaponState,
} from "@/lib/weapons/mechanics";
import { solveLp, type LpModel, type LpRow } from "./highs";
import { getWeapon, type SynthSource } from "./sources";
import type { Plan, Recipe, Stage, SynthUse } from "./types";

export type Objective = "abs" | "gilda" | "steps";

export interface Template {
  id: string;
  recipe: Recipe;
  /** Final weapon of the recipe and the level it is spectrumized at (= SP cost on the receiving weapon). */
  weaponId: string;
  level: number;
  /** Stat gains for the receiving weapon (At assumes the receiver's At is not lower: a safe lower bound). */
  gains: Partial<Stats>;
  abs: number;
  gilda: number;
  chapter: number;
}

export interface SolveInput {
  start: WeaponState;
  chain: string[];
  objective: Objective;
  spBonus: number;
  items: SynthSource[];
  templates: Template[];
  /** When set, a final stage is modelled in which these stats must be reached on the last weapon. */
  finalStats?: Partial<Stats>;
  finalLevel?: number;
  /** Highest level the model may level a weapon to (bounds model size). */
  maxLevel?: number;
  /** SP to leave unspent on the weapon when the last modelled stage ends (for ability coins added afterwards). */
  reserveSp?: number;
  /** Upper bound on gilda spent on items and sphere weapons (optional). */
  maxGilda?: number;
  /** Solver time limit in seconds. */
  timeLimitSec?: number;
  /** Relative optimality gap for exact solves (default 0.001). ~0.01 is far faster for high-tier chains. */
  mipGap?: number;
  /** Primal bound in objective units: solutions no better than this are pruned (used to skip chains). */
  objectiveBound?: number;
  /** Solve the continuous relaxation only (fast; used to pick candidate templates). */
  relax?: boolean;
}

export interface SolveResult {
  status: "optimal" | "infeasible" | "timedout" | "error";
  plan?: Plan;
  /** Objective value used by the solver (primary cost plus small tie-break terms). */
  value?: number;
}

const itemGain = (it: SynthSource, k: StatKey) => it.gains[k] ?? 0;
/**
 * Objective coefficients are scaled by this so every coefficient stays an integer (all game costs are
 * integers). HiGHS then knows the objective itself is integer-valued and can round its bounds up, which
 * is what makes the exact solves fast. `solveChain` unscales the reported value, so the secondary cost
 * keeps its 1/1000 tie-break weight from outside.
 */
const SCALE = 1000;

export function buildModel(input: SolveInput) {
  const { start, chain, objective, spBonus, items, templates } = input;
  const maxLevel = input.maxLevel ?? 40;
  const hasFinal = input.finalStats !== undefined || input.finalLevel !== undefined;
  const nStages = hasFinal ? chain.length : chain.length - 1;

  const model: LpModel = { objective: new Map(), rows: [], integers: [] };
  const rows = new Map<string, LpRow>();
  const row = (name: string, bounds: { min?: number; max?: number }) => {
    const r: LpRow = { name, coeffs: new Map(), ...bounds };
    rows.set(name, r);
    model.rows.push(r);
    return r;
  };
  const coef = (r: string, v: string, n: number) => {
    if (n === 0) return;
    const m = rows.get(r)!.coeffs;
    m.set(v, (m.get(v) ?? 0) + n);
  };
  // Primary objective plus a 1/SCALE weight on the other costs so ties resolve sensibly.
  const cost = (v: string, abs: number, gilda: number, steps = 0) => {
    const primary = objective === "abs" ? abs : objective === "gilda" ? gilda : steps;
    const secondary = objective === "abs" ? gilda : abs;
    model.objective.set(v, SCALE * primary + secondary);
  };

  const gildaRow =
    input.maxGilda === undefined ? undefined : row("cBudget", { max: input.maxGilda });

  const lStart: number[] = [];
  const spPerLevel: number[] = [];
  const spend: { v: string; amount: number }[][] = [];

  for (let j = 0; j < nStages; j++) {
    const w = getWeapon(chain[j]);
    const ls = j === 0 ? start.level : 0;
    lStart.push(ls);
    spPerLevel.push(w.spPerLevel + spBonus);
    spend.push([]);

    // ----- level variable and its ABS curve -----
    const L = `vL${j}`;
    const A = `vA${j}`;
    model.integers.push(L);
    cost(A, 1, 0);
    row(`cLmin${j}`, { min: ls });
    coef(`cLmin${j}`, L, 1);
    row(`cLmax${j}`, { max: maxLevel });
    coef(`cLmax${j}`, L, 1);
    const stored = j === 0 ? start.abs : 0;
    const absAt = (m: number) => Math.max(0, absBetween(w.baseAbs, ls, m) - stored);
    for (let m = ls; m < maxLevel; m++) {
      const slope = absAt(m + 1) - absAt(m);
      const c = `cCurve${j}_${m}`;
      row(c, { min: absAt(m) - slope * m });
      coef(c, A, 1);
      coef(c, L, -slope);
    }

    // ----- At gained from levelling: +r per level for the first five levels, +1 after (concave) -----
    const r = w.requiresKills.length > 0 ? 3 : 2;
    const early = Math.max(0, 5 - ls);
    const a = `vG${j}`;
    row(`cGa${j}`, { max: -r * ls });
    coef(`cGa${j}`, a, 1);
    coef(`cGa${j}`, L, -r);
    row(`cGb${j}`, { max: -ls + early * (r - 1) });
    coef(`cGb${j}`, a, 1);
    coef(`cGb${j}`, L, -1);

    // Stat rows first so item/sphere columns can attach to them.
    for (const k of STAT_KEYS) {
      const base = j === 0 ? start.stats[k] : buildUpBonus(w.baseStats[k]);
      row(`cSt${j}_${k}`, { max: base });
      coef(`cSt${j}_${k}`, `vE${j}_${k}`, 1);
      if (j > 0) coef(`cSt${j}_${k}`, `vE${j - 1}_${k}`, -1);
      if (k === "at") coef(`cSt${j}_${k}`, a, -1);
      row(`cCap${j}_${k}`, { max: w.maxStats[k] });
      coef(`cCap${j}_${k}`, `vE${j}_${k}`, 1);
      const next = chain[j + 1];
      if (next) {
        const need = buildUpRequirements(getWeapon(next))[k];
        if (need > 0) {
          row(`cReq${j}_${k}`, { min: need });
          coef(`cReq${j}_${k}`, `vE${j}_${k}`, 1);
        }
      } else if (input.finalStats?.[k]) {
        row(`cFin${j}_${k}`, { min: Math.min(input.finalStats[k]!, w.maxStats[k]) });
        coef(`cFin${j}_${k}`, `vE${j}_${k}`, 1);
      }
    }

    items.forEach((it, i) => {
      const v = `vX${j}_${i}`;
      model.integers.push(v);
      cost(v, 0, it.price ?? 0, 0.01);
      if (gildaRow) coef("cBudget", v, it.price ?? 0);
      spend[j].push({ v, amount: 1 });
      for (const k of STAT_KEYS) coef(`cSt${j}_${k}`, v, -itemGain(it, k));
    });

    templates.forEach((t, ti) => {
      const v = `vY${j}_${ti}`;
      model.integers.push(v);
      cost(v, t.abs, t.gilda, 1);
      if (gildaRow) coef("cBudget", v, t.gilda);
      spend[j].push({ v, amount: t.level });
      for (const k of STAT_KEYS) coef(`cSt${j}_${k}`, v, -(t.gains[k] ?? 0));
    });
  }

  if (input.finalLevel !== undefined && nStages > 0) {
    row("cFinLevel", { min: input.finalLevel });
    coef("cFinLevel", `vL${nStages - 1}`, 1);
  }

  // ----- SP budget, cumulative: sp0 + Σ spl_i (L_i - ls_i) - Σ spent >= 0 -----
  for (let j = 0; j < nStages; j++) {
    let constant = start.sp;
    for (let i = 0; i <= j; i++) constant -= spPerLevel[i] * lStart[i];
    const c = `cSp${j}`;
    row(c, { min: -constant + (j === nStages - 1 ? (input.reserveSp ?? 0) : 0) });
    for (let i = 0; i <= j; i++) {
      coef(c, `vL${i}`, spPerLevel[i]);
      for (const s of spend[i]) coef(c, s.v, -s.amount);
    }
  }

  return { model, nStages, hasFinal };
}

export async function solveChain(input: SolveInput): Promise<SolveResult> {
  const { model, nStages, hasFinal } = buildModel(input);
  if (input.relax) model.integers = [];
  const sol = await solveLp(model, {
    timeLimitSec: input.timeLimitSec,
    mipGap: input.mipGap,
    objectiveBound: input.objectiveBound === undefined ? undefined : input.objectiveBound * SCALE,
  });
  if (sol.status === "infeasible" || sol.status === "error") return { status: sol.status };
  if (!sol.values.size) return { status: sol.status };

  const get = (name: string) => Math.round(sol.values.get(name) ?? 0);
  const { chain, items, templates } = input;
  const stages: Stage[] = [];
  for (let j = 0; j < nStages; j++) {
    const synths: SynthUse[] = [];
    items.forEach((it, i) => {
      const n = get(`vX${j}_${i}`);
      if (n > 0) synths.push({ kind: "item", name: it.name, count: n });
    });
    templates.forEach((t, ti) => {
      const n = get(`vY${j}_${ti}`);
      for (let c = 0; c < n; c++) synths.push({ kind: "sphere", recipe: t.recipe });
    });
    stages.push({ weaponId: chain[j], levelTo: get(`vL${j}`), synths });
  }
  if (!hasFinal) stages.push({ weaponId: chain[chain.length - 1], levelTo: 0, synths: [] });
  // Undo the objective scaling (see SCALE); the value keeps the 1/1000 secondary tie-break weight.
  const value = sol.value === undefined ? undefined : sol.value / SCALE;
  return { status: sol.status, plan: { stages }, value };
}
