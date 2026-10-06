// Exact, rule-checking simulator: replays a Plan with the real mechanics and totals its cost.
// The optimiser proposes plans; this is the source of truth for whether they are valid.
import {
  absBetween,
  buildUp,
  canBuildUp,
  freshState,
  levelUpTo,
  sphereFromWeapon,
  statShortfalls,
  synth,
  MIN_SPHERE_LEVEL,
  type WeaponState,
} from "@/lib/weapons/mechanics";
import { STAT_KEYS } from "@/data/weapons-schema";
import { getWeapon, synthSourceByName } from "./sources";
import type { Acquire, Cost, LogEntry, Plan, Recipe, SimulationResult, Stage } from "./types";

export interface SimOptions {
  /** Extra SP per level from the matching support character (Cedric/Gerald/Milane/Lin). */
  spBonus: number;
  /** Enemy types already killed; undefined means "assume all requirements are met". */
  killed?: ReadonlySet<string>;
}

export const defaultSimOptions: SimOptions = { spBonus: 1 };

interface Run {
  state: WeaponState;
  cost: Cost;
  log: LogEntry[];
  errors: string[];
}

const acquireGilda = (a: Acquire) =>
  a.kind === "shop" ? a.price : a.kind === "invent" ? a.gilda : 0;

function runStages(
  run: Run,
  stages: Stage[],
  opts: SimOptions,
  depth: number,
  onStage?: (i: number, phase: "start" | "end") => void,
) {
  const runOne = (stage: Stage, i: number) => {
    const weapon = getWeapon(stage.weaponId);
    if (run.state.weaponId !== stage.weaponId) {
      run.errors.push(
        `stage ${i + 1} expects ${stage.weaponId} but the weapon is ${run.state.weaponId}`,
      );
      return;
    }

    if (stage.levelTo > run.state.level) {
      const from = run.state.level;
      const abs = Math.max(0, absBetween(weapon.baseAbs, from, stage.levelTo) - run.state.abs);
      run.state = levelUpTo(run.state, weapon, stage.levelTo, opts.spBonus);
      run.cost.abs += abs;
      run.cost.steps += 1;
      run.log.push({ type: "level", weaponId: weapon.id, from, to: stage.levelTo, abs, depth });
    } else if (stage.levelTo < run.state.level) {
      run.errors.push(
        `${weapon.name}: cannot level down to +${stage.levelTo} (already +${run.state.level})`,
      );
    }

    for (const use of stage.synths) {
      if (use.kind === "item") {
        const src = synthSourceByName.get(use.name);
        if (!src) {
          run.errors.push(`unknown synth item: ${use.name}`);
          continue;
        }
        if (run.state.sp < use.count) {
          run.errors.push(
            `${weapon.name}: needs ${use.count} SP for ${use.name} ×${use.count}, only ${run.state.sp} left`,
          );
          continue;
        }
        const gains = Object.fromEntries(
          Object.entries(src.gains).map(([k, v]) => [k, (v ?? 0) * use.count]),
        );
        run.state = synth(run.state, weapon, gains, use.count);
        const gilda = (src.price ?? 0) * use.count;
        run.cost.gilda += gilda;
        run.cost.steps += 1;
        run.log.push({
          type: "item",
          name: use.name,
          count: use.count,
          sp: use.count,
          gilda,
          depth,
        });
      } else {
        const sub = simulateRecipe(use.recipe, opts, depth + 1);
        run.cost.abs += sub.cost.abs;
        run.cost.gilda += sub.cost.gilda;
        run.cost.steps += sub.cost.steps + 1;
        run.log.push(...sub.log);
        run.errors.push(...sub.errors);
        const aux = sub.state;
        if (aux.level < MIN_SPHERE_LEVEL)
          run.errors.push(`${getWeapon(aux.weaponId).name} sphere is below +${MIN_SPHERE_LEVEL}`);
        const sphere = sphereFromWeapon(aux, run.state.stats.at);
        if (run.state.sp < sphere.sp) {
          run.errors.push(
            `${weapon.name}: needs ${sphere.sp} SP for a ${getWeapon(aux.weaponId).name} +${aux.level} sphere, only ${run.state.sp} left`,
          );
          continue;
        }
        run.state = synth(
          run.state,
          weapon,
          { ...sphere.gains, du: sphere.du },
          sphere.sp,
          aux.level >= MIN_SPHERE_LEVEL ? aux.abilities : [],
        );
        run.log.push({
          type: "sphere",
          weaponId: aux.weaponId,
          level: aux.level,
          sp: sphere.sp,
          gains: sphere.gains,
          depth,
        });
      }
    }

    run.log.push({
      type: "state",
      weaponId: weapon.id,
      level: run.state.level,
      sp: run.state.sp,
      stats: { ...run.state.stats },
      abilities: [...run.state.abilities],
      depth,
    });

    const next = stages[i + 1];
    if (next) {
      const target = getWeapon(next.weaponId);
      if (!weapon.buildsUpTo.includes(target.id)) {
        run.errors.push(`${weapon.name} cannot build up to ${target.name}`);
        return;
      }
      if (!canBuildUp(run.state, weapon, target, opts.killed ?? new Set(target.requiresKills))) {
        const short = statShortfalls(run.state.stats, target);
        const detail = STAT_KEYS.filter((k) => short[k])
          .map((k) => `${k} −${short[k]}`)
          .join(", ");
        run.errors.push(
          detail
            ? `${weapon.name} → ${target.name}: stats too low (${detail})`
            : `${weapon.name} → ${target.name}: missing enemy kills`,
        );
      }
      run.state = buildUp(run.state, target);
      run.cost.steps += 1;
      run.log.push({ type: "buildup", from: weapon.id, to: target.id, depth });
    }
  };
  stages.forEach((stage, i) => {
    onStage?.(i, "start");
    runOne(stage, i);
    onStage?.(i, "end");
  });
}

export function simulateRecipe(
  recipe: Recipe,
  opts: SimOptions,
  depth = 1,
): Run & { state: WeaponState } {
  const first = getWeapon(recipe.stages[0].weaponId);
  const run: Run = {
    state: freshState(first),
    cost: { abs: 0, gilda: acquireGilda(recipe.acquire), steps: 1 },
    log: [{ type: "acquire", weaponId: first.id, acquire: recipe.acquire, depth }],
    errors: [],
  };
  runStages(run, recipe.stages, opts, depth);
  return run;
}

export function simulatePlan(
  start: WeaponState,
  plan: Plan,
  opts: SimOptions = defaultSimOptions,
): SimulationResult & { state: WeaponState } {
  const run: Run = { state: start, cost: { abs: 0, gilda: 0, steps: 0 }, log: [], errors: [] };
  const perStage: { errors: string[]; cost: Cost }[] = [];
  let mark = { errors: 0, cost: { ...run.cost } };
  if (plan.stages[0] && plan.stages[0].weaponId !== start.weaponId)
    run.errors.push("plan does not start with the start weapon");
  else
    runStages(run, plan.stages, opts, 0, (i, phase) => {
      if (phase === "start") mark = { errors: run.errors.length, cost: { ...run.cost } };
      else
        perStage[i] = {
          errors: run.errors.slice(mark.errors),
          cost: {
            abs: run.cost.abs - mark.cost.abs,
            gilda: run.cost.gilda - mark.cost.gilda,
            steps: run.cost.steps - mark.cost.steps,
          },
        };
    });
  return { state: run.state, cost: run.cost, log: run.log, errors: run.errors, stages: perStage };
}
