// Profiles the planner's heaviest realistic request: the final weapon of each build-up line
// (`finalWeaponIds` from the planner graph), planned from the line's root weapon (the "optimal
// start point") through the full build-up chain, with the max-stats goal.
// Settings: chapter 8, support bonus, buyable-only items, least-ABS objective; warm sphere templates
// (the app pre-warms them from the form).
// Run: pnpm exec vite-node --config vitest.config.ts scripts/planner/profile.ts
import { freshState } from "../../src/lib/weapons/mechanics.ts";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "../../src/lib/planner/graph.ts";
import { planPath } from "../../src/lib/planner/plan.ts";
import { getWeapon } from "../../src/lib/planner/sources.ts";
import { generateTemplates } from "../../src/lib/planner/templates.ts";

/** The generator's "optimal start point": the first root weapon that builds up into the target. */
function defaultStart(targetId: string): string {
  return [...ancestorsOf(targetId)].find((id) => rootWeaponIds.has(id)) ?? targetId;
}

const OPTS = { maxChapter: 8, allowFound: false, spBonus: 1 } as const;

// The app pre-warms the sphere templates from the planner form, so measured plans are warm too.
const tGen = performance.now();
await generateTemplates(OPTS);
console.log(
  `sphere templates: ${((performance.now() - tGen) / 1000).toFixed(2)} s (one-off; pre-warmed in the app)`,
);

const rows: string[][] = [];
let total = 0;
for (const targetId of finalWeaponIds) {
  const startId = defaultStart(targetId);
  const t0 = performance.now();
  const r = await planPath({
    start: freshState(getWeapon(startId)),
    targetId,
    objective: "abs",
    goal: { kind: "max" },
    maxChapter: OPTS.maxChapter,
    spBonus: OPTS.spBonus,
    allowFound: OPTS.allowFound,
  });
  const sec = (performance.now() - t0) / 1000;
  total += sec;
  const buildUps = r.plan ? r.plan.stages.length - 1 : r.alternatives.length;
  const detail =
    r.status === "ok" && r.simulation
      ? `${r.simulation.errors.length ? "SIM ERRORS, " : ""}${r.simulation.cost.abs} ABS / ${r.simulation.cost.gilda} gilda`
      : r.status;
  rows.push([
    getWeapon(targetId).type,
    getWeapon(targetId).name,
    getWeapon(startId).name,
    String(buildUps),
    `${sec.toFixed(2)} s`,
    detail,
  ]);
}

const w = [0, 1, 2, 3, 4].map((i) => Math.max(...rows.map((r) => r[i].length)));
console.log(
  `\n${"Type".padEnd(w[0])}  ${"Final weapon".padEnd(w[1])}  ${"Start (root)".padEnd(w[2])}  ${"Build-ups".padEnd(w[3])}  ${"Time".padEnd(w[4])}`,
);
for (const r of rows)
  console.log(
    `${r[0].padEnd(w[0])}  ${r[1].padEnd(w[1])}  ${r[2].padEnd(w[2])}  ${r[3].padEnd(w[3])}  ${r[4].padEnd(w[4])}  ${r[5]}`,
  );
console.log(`\n${finalWeaponIds.length} plans, total ${total.toFixed(1)} s`);
