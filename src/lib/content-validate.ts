// Deep validation for user-supplied guides (imports and editor). Structural zod checks run first; these checks make
// sure everything a page will look up (weapons, items, chapters, sections, referenced data) actually exists.
import { chapterById, sectionById } from "@/lib/data";
import { knownItemIds, knownSectionIds } from "@/lib/guide/refs";
import type { Guide } from "@/lib/guide/types";
import { synthSourceByName, weaponById } from "@/lib/planner/sources";
import type { Recipe, Stage } from "@/lib/planner/types";

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
  if (g.build && !weaponById.has(g.build.weaponId))
    errors.push(`unknown start weapon "${g.build.weaponId}"`);
  if (g.steps.some((s) => s.build) && !g.build) errors.push("has build steps but no start weapon");
  const stepIds = new Set<string>();
  g.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (stepIds.has(s.id)) errors.push(`${at}: duplicate id`);
    stepIds.add(s.id);
    if (s.chapterId && !chapterById.has(s.chapterId))
      errors.push(`${at}: unknown chapter "${s.chapterId}"`);
    if (s.sectionId) {
      const sec = sectionById.get(s.sectionId);
      if (!sec) errors.push(`${at}: unknown section "${s.sectionId}"`);
      else if (s.chapterId && sec.chapterId !== s.chapterId)
        errors.push(`${at}: section "${s.sectionId}" is not in ${s.chapterId}`);
    }
    const textIds = new Set<string>();
    for (const e of s.entries) {
      if (e.kind === "text") {
        if (textIds.has(e.id)) errors.push(`${at}: duplicate checklist id`);
        textIds.add(e.id);
      } else if (e.kind === "item" && !knownItemIds.has(e.ref))
        errors.push(`${at}: unknown item "${e.ref}"`);
      else if (e.kind === "section" && !knownSectionIds.has(e.ref))
        errors.push(`${at}: unknown section "${e.ref}"`);
    }
    if (s.build) checkStage(s.build, at, errors);
  });
  return errors;
}
