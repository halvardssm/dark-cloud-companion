import { describe, expect, test } from "vitest";
import { guide as guideSchema } from "./types";
import { planToGuide } from "./fromPlan";
import { planPath } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";

describe("planToGuide", () => {
  test("turns a plan into ordered, chapter-tagged steps that validate", async () => {
    const result = await planPath({
      start: freshState(getWeapon("battle-wrench")),
      targetId: "stinger-wrench",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 4,
      spBonus: 1,
    });
    expect(result.status).toBe("ok");
    const g = planToGuide({ id: "t", title: "T", kind: "custom", summary: "s", result });
    expect(guideSchema.safeParse(g).success).toBe(true);
    expect(g.steps.map((s) => s.stage.weaponId)).toEqual(result.chain);
    const chapters = g.steps.map((s) => s.chapter);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(Math.max(...chapters)).toBeLessThanOrEqual(4);
    expect(g.totals.abs).toBe(result.simulation!.cost.abs);
    // Every step but the last builds up into the next weapon.
    g.steps
      .slice(0, -1)
      .forEach((s, i) => expect(s.buildsUpTo).toBe(g.steps[i + 1].stage.weaponId));
  });
});
