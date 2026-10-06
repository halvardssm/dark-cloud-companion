// Checks the predefined plans (src/data/plans.json) against the config they were generated from:
// the plans must cover exactly the configured variants, and every plan must derive cleanly and
// actually deliver the goal it promises.
import plansJson from "@/data/plans.json";
import { STAT_KEYS } from "@/lib/schemas";
import { getWeapon } from "@/lib/planner/sources";
import { z } from "zod";
import { describe, expect, test } from "vitest";
import { plansConfig } from "../../../scripts/planner/plans.config";
import { expandPlans, parsePlansConfig } from "../../../scripts/planner/plans-config";
import { deriveBuild } from "./derive";
import { guide } from "./types";

const file = z.object({ hash: z.string(), guides: z.array(guide) }).parse(plansJson);
const specs = expandPlans(parsePlansConfig(plansConfig));
const specById = new Map(specs.map((s) => [s.id, s]));

describe("predefined plans (src/data/plans.json)", () => {
  test("cover the config exactly, one guide per target and variant", () => {
    expect(file.guides.map((g) => g.id)).toEqual(specs.map((s) => s.id));
    for (const g of file.guides) expect(g.kind).toBe("builtin");
  });

  test("every plan is simulator-valid and delivers its goal", () => {
    expect(file.guides.length).toBeGreaterThan(0);
    for (const g of file.guides) {
      const spec = specById.get(g.id)!;
      const d = deriveBuild(g);
      expect(d.errors, g.id).toEqual([]);
      for (const s of d.steps.values()) expect(s.errors, `${g.id}/${s.stepId}`).toEqual([]);
      expect(d.final!.weaponId, g.id).toBe(spec.targetId);
      if (spec.goal === "max") {
        const max = getWeapon(spec.targetId).maxStats;
        for (const k of STAT_KEYS)
          expect(d.final!.stats[k], `${g.id} ${k}`).toBeGreaterThanOrEqual(max[k]);
      }
      for (const a of spec.abilities) expect(d.final!.abilities, `${g.id} ${a}`).toContain(a);
      // The optimal start may be a bought weapon; the guide records how to get it.
      expect(g.build!.acquire, g.id).toBeDefined();
    }
  });
});
