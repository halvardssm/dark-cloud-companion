import { buildUpRequirements } from "@/lib/weapons/mechanics";
import type { PlanResult } from "@/lib/planner/plan";
import { getWeapon, synthSourceByName, weaponData } from "@/lib/planner/sources";
import type { Acquire, Recipe, Stage } from "@/lib/planner/types";
import type { Guide, GuideStep } from "./types";

const enemyChapter = new Map(weaponData.killEnemies.map((e) => [e.name, e.chapter ?? 8]));

const itemChapter = (name: string) => synthSourceByName.get(name)?.fromChapter ?? 1;

function recipeChapter(r: Recipe): number {
  const acq = r.acquire.kind === "have" ? 1 : r.acquire.chapter;
  let ch = acq;
  for (const s of r.stages) ch = Math.max(ch, stageResourceChapter(s));
  return ch;
}

/** Latest chapter among the items, sphere weapons and enemy kills this stage depends on. */
function stageResourceChapter(stage: Stage): number {
  let ch = 1;
  for (const u of stage.synths) {
    ch = Math.max(ch, u.kind === "item" ? itemChapter(u.name) : recipeChapter(u.recipe));
  }
  return ch;
}

export function planToGuide(args: {
  id: string;
  title: string;
  kind: Guide["kind"];
  summary: string;
  result: PlanResult;
  createdAt?: number;
  /** Set when the guide starts by acquiring the weapon (curated guides). */
  start?: { weaponId: string; acquire: Acquire };
}): Guide {
  const { result } = args;
  if (!result.plan || !result.simulation || !result.chain) throw new Error("no plan to convert");
  const { plan, simulation } = result;
  const snapshots = simulation.log.filter((l) => l.type === "state" && l.depth === 0);

  let chapter = args.start?.acquire.kind === "have" || !args.start ? 1 : args.start.acquire.chapter;
  const steps: GuideStep[] = plan.stages.map((stage, i) => {
    const next = plan.stages[i + 1];
    const snap = snapshots[i];
    const kills = next ? getWeapon(next.weaponId).requiresKills : [];
    chapter = Math.max(
      chapter,
      stageResourceChapter(stage),
      ...kills.map((e) => enemyChapter.get(e) ?? 8),
    );
    const level = simulation.log.find(
      (l) => l.type === "level" && l.depth === 0 && l.weaponId === stage.weaponId,
    );
    return {
      id: `s${i + 1}`,
      chapter,
      stage,
      buildsUpTo: next?.weaponId,
      stats: snap && snap.type === "state" ? snap.stats : ({} as GuideStep["stats"]),
      requirements: next ? buildUpRequirements(getWeapon(next.weaponId)) : undefined,
      level: snap && snap.type === "state" ? snap.level : 0,
      spLeft: snap && snap.type === "state" ? snap.sp : 0,
      abs: level && level.type === "level" ? level.abs : 0,
    };
  });

  return {
    id: args.id,
    title: args.title,
    kind: args.kind,
    summary: args.summary,
    targetId: result.chain[result.chain.length - 1],
    ...(args.start ? { start: args.start } : {}),
    totals: {
      ...simulation.cost,
      gilda:
        simulation.cost.gilda +
        (args.start?.acquire.kind === "shop"
          ? args.start.acquire.price
          : args.start?.acquire.kind === "invent"
            ? args.start.acquire.gilda
            : 0),
    },
    steps,
    createdAt: args.createdAt,
  };
}
