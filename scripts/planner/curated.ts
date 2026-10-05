// Generates the built-in guides with our own planner (so no guide prose is copied).
// Run: pnpm exec vite-node --config vitest.config.ts scripts/planner/curated.ts
import { writeFileSync } from "node:fs";
import { planToGuide } from "../../src/lib/guides/fromPlan.ts";
import { guide as guideSchema, type Guide } from "../../src/lib/guides/types.ts";
import { ancestorsOf } from "../../src/lib/planner/graph.ts";
import { earliestChapter, planPath } from "../../src/lib/planner/plan.ts";
import { acquisitionOptions, getWeapon } from "../../src/lib/planner/sources.ts";
import type { Acquire } from "../../src/lib/planner/types.ts";
import { freshState } from "../../src/lib/weapons/mechanics.ts";

const TARGETS = [
  "grade-zero",
  "legend",
  "supernova",
  "griffon-fork",
  "island-king",
  "dark-cloud",
  "five-star-armlet",
];
const OBJECTIVES = [
  { id: "abs", label: "Least ABS", maxGilda: undefined },
  { id: "budget", label: "Least ABS on a budget", maxGilda: 15000 },
] as const;

const SUPPORT = 1;

const chapterOf = (a: Acquire) => (a.kind === "have" ? 1 : a.chapter);
const priceOf = (a: Acquire) => (a.kind === "shop" ? a.price : a.kind === "invent" ? a.gilda : 0);
function cheapest(id: string, chapter: number): Acquire {
  const opts = acquisitionOptions(id).filter((a) => chapterOf(a) <= chapter);
  return opts.sort((a, b) => priceOf(a) - priceOf(b))[0] ?? { kind: "have" };
}

/** Start weapons that can be obtained by `chapter` and build up into the target. */
function startCandidates(targetId: string, chapter: number): string[] {
  const anc = ancestorsOf(targetId);
  return [...anc].filter((id) =>
    acquisitionOptions(id).some((a) => (a.kind === "have" ? 1 : a.chapter) <= chapter),
  );
}

async function bestStart(targetId: string, maxChapter: number, maxGilda: number | undefined) {
  const cands = startCandidates(targetId, maxChapter);
  let best: { id: string; bound: number } | undefined;
  for (const id of cands) {
    const r = await planPath({
      start: freshState(getWeapon(id)),
      targetId,
      objective: "abs",
      goal: { kind: "max" },
      maxChapter,
      spBonus: SUPPORT,
      maxGilda,
      exactChains: 0,
    });
    const bound = Math.min(...r.alternatives.map((a) => a.bound ?? Infinity));
    if (Number.isFinite(bound) && (!best || bound < best.bound)) best = { id, bound };
  }
  return best?.id;
}

const guides: Guide[] = [];
for (const targetId of TARGETS) {
  for (const obj of OBJECTIVES) {
    const target = getWeapon(targetId);
    const maxChapter = earliestChapter(startCandidates(targetId, 8)[0] ?? targetId, targetId);
    const startId = await bestStart(targetId, maxChapter, obj.maxGilda);
    if (!startId) {
      console.warn(`skip ${targetId}/${obj.id}: no start`);
      continue;
    }
    const goal = { kind: "max" } as const;
    const startAcquire = cheapest(startId, maxChapter);
    const t0 = Date.now();
    const result = await planPath({
      start: freshState(getWeapon(startId)),
      targetId,
      objective: "abs",
      goal,
      maxChapter,
      spBonus: SUPPORT,
      maxGilda: obj.maxGilda,
      timeLimitSec: 120,
    });
    if (result.status !== "ok") {
      console.warn(`skip ${targetId}/${obj.id}: ${result.status}`);
      continue;
    }
    guides.push(
      guideSchema.parse(
        planToGuide({
          id: `${targetId}-${obj.id}`,
          title: `${target.name} — ${obj.label}`,
          kind: "curated",
          summary: `${obj.label} · maxed stats · from ${getWeapon(startId).name} · up to chapter ${maxChapter}`,
          result,
          start: { weaponId: startId, acquire: startAcquire },
        }),
      ),
    );
    console.log(
      `${targetId}/${obj.id}: start ${startId}, ch ${maxChapter}, ${result.simulation!.cost.abs} ABS, ${result.simulation!.cost.gilda} gilda, ${Date.now() - t0} ms`,
    );
  }
}

writeFileSync("src/data/guides.json", JSON.stringify(guides, null, 2) + "\n");
console.log(`wrote ${guides.length} guides`);
