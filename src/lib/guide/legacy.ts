// Converters from the previous model (separate build guides and walkthroughs) to unified guides.
import { chapters } from "@/lib/data";
import type { Guide as LegacyGuide } from "@/lib/guides/types";
import type { Stage } from "@/lib/planner/types";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";
import type { Walkthrough } from "@/lib/walkthroughs/types";
import type { BuildStart, Guide, Step } from "./types";

const chapterIdOf = (n: number) => chapters.find((c) => c.phase === "main" && c.number === n)?.id;

export function stateToStart(
  weaponId: string,
  spBonus: number,
  acquire?: BuildStart["acquire"],
): BuildStart {
  const s = freshState(getWeapon(weaponId));
  return {
    weaponId,
    level: s.level,
    abs: s.abs,
    stats: s.stats,
    du: s.du,
    sp: s.sp,
    abilities: s.abilities,
    spBonus,
    ...(acquire ? { acquire } : {}),
  };
}

/** A legacy build guide becomes a guide with one build step per stage (stats are recomputed by `deriveBuild`). */
export function fromLegacyGuide(g: LegacyGuide, spBonus = 1): Guide {
  const first = g.steps[0]?.stage as Stage | undefined;
  const startId = g.start?.weaponId ?? first?.weaponId ?? g.targetId;
  const steps: Step[] = g.steps.map((s, i) => {
    const stage = s.stage as Stage;
    const next = g.steps[i + 1]?.stage as Stage | undefined;
    return {
      id: s.id,
      title: getWeapon(stage.weaponId).name + (next ? ` → ${getWeapon(next.weaponId).name}` : ""),
      notes: "",
      chapterId: chapterIdOf(s.chapter),
      entries: [],
      build: stage,
    };
  });
  return {
    id: g.id,
    title: g.title,
    description: g.summary,
    kind: g.kind === "curated" ? "builtin" : "custom",
    build: stateToStart(startId, spBonus, g.start?.acquire),
    steps,
    ...(g.createdAt ? { createdAt: g.createdAt, updatedAt: g.createdAt } : {}),
  };
}

/** A legacy walkthrough becomes a guide of text steps; its checklist items keep their ids so ticks migrate 1:1. */
export function fromLegacyWalkthrough(w: Walkthrough): Guide {
  return {
    id: w.id,
    title: w.title,
    ...(w.description ? { description: w.description } : {}),
    kind: "custom",
    steps: w.steps.map((s) => ({
      id: s.id,
      title: s.title,
      notes: s.notes,
      chapterId: s.chapterId,
      ...(s.sectionId ? { sectionId: s.sectionId } : {}),
      entries: s.checklist.map((i) => ({ kind: "text" as const, id: i.id, text: i.text })),
    })),
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

/** Rewrites progress keys from the old schemes to `g:<guide>:<step>[:<entry>]`. */
export function migrateTickId(id: string): string {
  if (id.startsWith("guide:")) return `g:${id.slice("guide:".length)}`;
  if (id.startsWith("wt:")) return `g:${id.slice("wt:".length)}`;
  return id;
}
