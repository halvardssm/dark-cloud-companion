import { chapters } from "@/lib/data";
import { enemyChapter, stageResourceChapter } from "@/lib/guides/fromPlan";
import type { PlanResult } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import type { Acquire } from "@/lib/planner/types";
import type { WeaponState } from "@/lib/weapons/mechanics";
import { newId, type BuildStart, type Guide, type Step } from "./types";

const chapterIdOf = (n: number) => chapters.find((c) => c.phase === "main" && c.number === n)?.id;

export function stateToBuildStart(s: WeaponState, spBonus: number, acquire?: Acquire): BuildStart {
  return {
    weaponId: s.weaponId,
    level: s.level,
    abs: s.abs,
    stats: { ...s.stats },
    du: s.du,
    sp: s.sp,
    abilities: [...s.abilities],
    spBonus: spBonus ? 1 : 0,
    ...(acquire ? { acquire } : {}),
  };
}

/** Turns a planner result into a guide: one build step per stage, each placed in the earliest workable chapter. */
export function planResultToGuide(args: {
  id?: string;
  title: string;
  description?: string;
  result: PlanResult;
  start: WeaponState;
  spBonus: number;
  acquire?: Acquire;
  kind?: Guide["kind"];
  createdAt?: number;
}): Guide {
  const { result } = args;
  if (!result.plan || !result.chain) throw new Error("no plan to convert");
  const stages = result.plan.stages;
  let chapter = 1;
  const steps: Step[] = stages.map((stage, i) => {
    const next = stages[i + 1];
    const kills = next ? getWeapon(next.weaponId).requiresKills : [];
    chapter = Math.max(
      chapter,
      stageResourceChapter(stage),
      ...kills.map((e) => enemyChapter.get(e) ?? 8),
    );
    return {
      id: `s${i + 1}`,
      title: getWeapon(stage.weaponId).name + (next ? ` → ${getWeapon(next.weaponId).name}` : ""),
      notes: "",
      chapterId: chapterIdOf(Math.min(chapter, 8)),
      entries: [],
      build: stage,
    };
  });
  return {
    id: args.id ?? `g-${Date.now().toString(36)}-${newId()}`,
    title: args.title,
    ...(args.description ? { description: args.description } : {}),
    kind: args.kind ?? "custom",
    build: stateToBuildStart(args.start, args.spBonus, args.acquire),
    steps,
    createdAt: args.createdAt ?? Date.now(),
    updatedAt: args.createdAt ?? Date.now(),
  };
}

/**
 * Continues a build guide with a freshly generated plan. The plan starts from the weapon the base guide ends with,
 * so its first stage is merged into the base's last build step; the remaining stages are appended.
 */
export function appendPlanToGuide(base: Guide, generated: Guide, title: string): Guide {
  const lastIdx = base.steps.map((s) => !!s.build).lastIndexOf(true);
  const firstGen = generated.steps.find((s) => s.build);
  if (lastIdx < 0 || !firstGen) throw new Error("both guides need build steps");
  const baseStage = base.steps[lastIdx].build!;
  const genStage = firstGen.build!;
  const steps = structuredClone(base.steps);
  const nextWeapon = generated.steps.filter((s) => s.build && s !== firstGen)[0]?.build?.weaponId;
  steps[lastIdx] = {
    ...steps[lastIdx],
    // The last stage now builds up into the first newly planned weapon.
    ...(nextWeapon
      ? { title: `${getWeapon(baseStage.weaponId).name} → ${getWeapon(nextWeapon).name}` }
      : {}),
    build: {
      weaponId: baseStage.weaponId,
      levelTo: Math.max(baseStage.levelTo, genStage.levelTo),
      synths: [...baseStage.synths, ...genStage.synths],
    },
  };
  const rest = generated.steps.filter((s) => s.build && s !== firstGen);
  const now = Date.now();
  return {
    ...structuredClone(base),
    id: `g-${now.toString(36)}-${newId()}`,
    title,
    kind: "custom",
    steps: [...steps, ...rest.map((s, i) => ({ ...s, id: `p${i + 1}-${s.id}` }))],
    createdAt: now,
    updatedAt: now,
  };
}
