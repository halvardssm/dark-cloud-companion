// Bench: optimal-start search vs the old single-root start on the known worst-case targets.
// Usage: vite-node scripts/planner/bench-starts.ts <weaponId> [root|optimal]
import { planPath } from "../../src/lib/planner/plan.ts";
import { freshState } from "../../src/lib/weapons/mechanics.ts";
import { ancestorsOf, rootWeaponIds } from "../../src/lib/planner/graph.ts";
import { getWeapon } from "../../src/lib/planner/sources.ts";

const targetId = process.argv[2];
const mode = (process.argv[3] ?? "optimal") as "root" | "optimal";
const ancestors = [...ancestorsOf(targetId)];
const root = ancestors.find((id) => rootWeaponIds.has(id)) ?? targetId;

const t0 = Date.now();
const r = await planPath({
  start: freshState(getWeapon(mode === "root" ? root : targetId)),
  optimalStart: mode === "optimal",
  targetId,
  objective: "abs",
  goal: { kind: "max" },
  maxChapter: 8,
  spBonus: 1,
});
const ms = Date.now() - t0;
console.log(
  `${mode} ${targetId}: ${r.status} in ${(ms / 1000).toFixed(1)}s · start=${r.plan?.stages[0].weaponId} acquire=${JSON.stringify(r.acquire)} · abs=${r.simulation?.cost.abs} gilda=${r.simulation?.cost.gilda} steps=${r.simulation?.cost.steps} · errors=${r.simulation?.errors.length ?? "?"} · alternatives=${r.alternatives.length}`,
);
