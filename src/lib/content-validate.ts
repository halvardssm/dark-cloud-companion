// Deep validation for user-supplied content (imports). Structural zod checks run first; these checks make sure
// everything a page will look up (weapons, items, chapters, sections) actually exists, so rendering can't throw.
import { chapterById, sectionById } from "@/lib/data";
import { synthSourceByName, weaponById } from "@/lib/planner/sources";
import type { Recipe, Stage } from "@/lib/planner/types";
import type { Guide } from "@/lib/guides/types";
import type { Walkthrough } from "@/lib/walkthroughs/types";

function checkStage(stage: Stage, path: string, errors: string[], depth = 0) {
  if (depth > 3) {
    errors.push(`${path}: sphere recipes nested too deeply`);
    return;
  }
  if (!weaponById.has(stage.weaponId)) errors.push(`${path}: unknown weapon "${stage.weaponId}"`);
  for (const s of stage.synths ?? []) {
    if (s.kind === "item") {
      if (!synthSourceByName.has(s.name)) errors.push(`${path}: unknown item "${s.name}"`);
      if (!Number.isFinite(s.count) || s.count < 1) errors.push(`${path}: bad item count`);
    } else if (s.kind === "sphere") {
      checkRecipe(s.recipe, `${path} sphere`, errors, depth + 1);
    } else {
      errors.push(`${path}: unknown synth kind`);
    }
  }
}

function checkRecipe(r: Recipe, path: string, errors: string[], depth: number) {
  if (!r || !Array.isArray(r.stages) || r.stages.length === 0) {
    errors.push(`${path}: recipe has no stages`);
    return;
  }
  r.stages.forEach((s, i) => checkStage(s, `${path} stage ${i + 1}`, errors, depth));
}

export function validateGuide(g: Guide): string[] {
  const errors: string[] = [];
  if (!weaponById.has(g.targetId)) errors.push(`unknown target weapon "${g.targetId}"`);
  if (g.start && !weaponById.has(g.start.weaponId))
    errors.push(`unknown start weapon "${g.start.weaponId}"`);
  g.steps.forEach((s, i) => {
    checkStage(s.stage as Stage, `step ${i + 1}`, errors);
    if (s.buildsUpTo && !weaponById.has(s.buildsUpTo))
      errors.push(`step ${i + 1}: unknown weapon "${s.buildsUpTo}"`);
  });
  return errors;
}

export function validateWalkthrough(w: Walkthrough): string[] {
  const errors: string[] = [];
  const stepIds = new Set<string>();
  w.steps.forEach((s, i) => {
    if (stepIds.has(s.id)) errors.push(`step ${i + 1}: duplicate id`);
    stepIds.add(s.id);
    if (!chapterById.has(s.chapterId))
      errors.push(`step ${i + 1}: unknown chapter "${s.chapterId}"`);
    if (s.sectionId) {
      const sec = sectionById.get(s.sectionId);
      if (!sec || sec.chapterId !== s.chapterId)
        errors.push(`step ${i + 1}: section "${s.sectionId}" is not in ${s.chapterId}`);
    }
    const items = new Set<string>();
    for (const it of s.checklist) {
      if (items.has(it.id)) errors.push(`step ${i + 1}: duplicate checklist id`);
      items.add(it.id);
    }
  });
  return errors;
}
