// Derived data for a guide's weapon-build steps. Stats, costs and requirement checks are never stored: they are
// recomputed with the rule-checking simulator so edited or imported guides always show the truth.
import type { Stats } from "@/lib/schemas";
import { simulatePlan } from "@/lib/planner/simulate";
import { getWeapon, weaponById } from "@/lib/planner/sources";
import type { Cost } from "@/lib/planner/types";
import { buildUpRequirements, type WeaponState } from "@/lib/weapons/mechanics";
import type { BuildStart, Guide } from "./types";

export function startToState(b: BuildStart): WeaponState {
  return {
    weaponId: b.weaponId,
    level: b.level,
    abs: b.abs,
    stats: { ...b.stats },
    du: b.du,
    sp: b.sp,
    abilities: [...b.abilities],
  };
}

export interface DerivedStep {
  stepId: string;
  /** State after the stage's levelling and synths, before building up. */
  level: number;
  sp: number;
  stats: Stats;
  abilities: string[];
  /** Requirements of the next build step's weapon, when there is one. */
  requirements?: Stats;
  nextWeaponId?: string;
  cost: Cost;
  errors: string[];
}

export interface DerivedBuild {
  steps: Map<string, DerivedStep>;
  total: Cost;
  /** Errors not attributable to one step (e.g. the first stage doesn't match the start weapon). */
  errors: string[];
  final?: WeaponState;
}

export function deriveBuild(guide: Guide): DerivedBuild {
  const empty: DerivedBuild = {
    steps: new Map(),
    total: { abs: 0, gilda: 0, steps: 0 },
    errors: [],
  };
  const buildSteps = guide.steps.filter((s) => s.build);
  if (!buildSteps.length) return empty;
  if (!guide.build)
    return { ...empty, errors: ["This guide has build steps but no start weapon."] };
  for (const s of buildSteps) {
    if (!weaponById.has(s.build!.weaponId))
      return { ...empty, errors: [`Unknown weapon "${s.build!.weaponId}".`] };
  }
  const sim = simulatePlan(
    startToState(guide.build),
    { stages: buildSteps.map((s) => s.build!) },
    { spBonus: guide.build.spBonus },
  );
  const steps = new Map<string, DerivedStep>();
  const snapshots = sim.log.filter((l) => l.type === "state" && l.depth === 0);
  buildSteps.forEach((s, i) => {
    const snap = snapshots[i];
    const next = buildSteps[i + 1]?.build?.weaponId;
    steps.set(s.id, {
      stepId: s.id,
      level: snap?.type === "state" ? snap.level : 0,
      sp: snap?.type === "state" ? snap.sp : 0,
      stats: snap?.type === "state" ? snap.stats : ({} as Stats),
      abilities: snap?.type === "state" ? snap.abilities : [],
      ...(next ? { requirements: buildUpRequirements(getWeapon(next)), nextWeaponId: next } : {}),
      cost: sim.stages?.[i]?.cost ?? { abs: 0, gilda: 0, steps: 0 },
      errors: sim.stages?.[i]?.errors ?? [],
    });
  });
  const attributed = new Set((sim.stages ?? []).flatMap((st) => st.errors));
  // The simulator starts from an already-owned weapon; obtaining it (shop purchase, invention)
  // is part of the guide's cost when the start says how it was acquired.
  const acquire = guide.build.acquire;
  const acquireGilda =
    acquire?.kind === "shop" ? acquire.price : acquire?.kind === "invent" ? acquire.gilda : 0;
  return {
    steps,
    total: {
      abs: sim.cost.abs,
      gilda: sim.cost.gilda + acquireGilda,
      steps: sim.cost.steps + (acquire && acquire.kind !== "have" ? 1 : 0),
    },
    errors: sim.errors.filter((e) => !attributed.has(e)),
    final: sim.state,
  };
}
