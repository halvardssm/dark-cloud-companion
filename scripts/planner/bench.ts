// Planner perf bench. Two modes:
//   profile                            every final weapon, max goal, root start, warm sphere
//                                      templates — the planner's heaviest realistic requests
//   start <weaponId> [root|optimal]    one target with the max goal, comparing the optimal-start
//                                      search against a fixed root start
// Run: pnpm exec vite-node --config vitest.config.ts scripts/planner/bench.ts <mode> [...]
import { freshState } from "../../src/lib/weapons/mechanics.ts";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "../../src/lib/planner/graph.ts";
import { planPath } from "../../src/lib/planner/plan.ts";
import { getWeapon } from "../../src/lib/planner/sources.ts";
import { generateTemplates } from "../../src/lib/planner/templates.ts";

const OPTS = { maxChapter: 8, allowFound: false, spBonus: 1 } as const;

/** The generator's "optimal start point": the first root weapon that builds up into the target. */
function defaultStart(targetId: string): string {
  return [...ancestorsOf(targetId)].find((id) => rootWeaponIds.has(id)) ?? targetId;
}

async function profile() {
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
}

async function benchStart(targetId: string, mode: "root" | "optimal") {
  const root = defaultStart(targetId);
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
}

const mode = process.argv[2] ?? "profile";
if (mode === "start")
  await benchStart(process.argv[3]!, (process.argv[4] ?? "optimal") as "root" | "optimal");
else await profile();
