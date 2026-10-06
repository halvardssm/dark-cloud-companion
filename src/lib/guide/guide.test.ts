import { describe, expect, test } from "vitest";
import { checklist, sections } from "@/lib/data";
import legacyCuratedRaw from "./fixtures/legacy-curated.json";
import { guide as legacyGuideSchema, type Guide as LegacyGuide } from "@/lib/guides/types";
import { z } from "zod";

const curatedGuides: LegacyGuide[] = z.array(legacyGuideSchema).parse(legacyCuratedRaw);
import { deriveBuild } from "./derive";
import { fromLegacyGuide, fromLegacyWalkthrough, migrateTickId } from "./legacy";
import { mainWalkthrough } from "./main";
import { entryTickIds, knownItemIds, knownSectionIds } from "./refs";
import { guide as guideSchema, textTickId } from "./types";
import { emptyWalkthrough } from "@/lib/walkthroughs/types";

describe("main walkthrough", () => {
  test("validates and has unique step ids", () => {
    expect(guideSchema.safeParse(mainWalkthrough).success).toBe(true);
    const ids = mainWalkthrough.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("references every checklist item exactly once", () => {
    const refs = mainWalkthrough.steps
      .flatMap((s) => s.entries)
      .flatMap((e) => (e.kind === "item" ? [e.ref] : []));
    expect(refs).toHaveLength(checklist.length);
    expect(new Set(refs)).toEqual(new Set(checklist.map((i) => i.id)));
  });

  test("references every section that has facts exactly once, and only real data", () => {
    const refs = mainWalkthrough.steps
      .flatMap((s) => s.entries)
      .flatMap((e) => (e.kind === "section" ? [e.ref] : []));
    expect(new Set(refs).size).toBe(refs.length);
    for (const r of refs) expect(knownSectionIds.has(r)).toBe(true);
    for (const s of sections.filter((x) => x.medals)) expect(refs).toContain(s.id);
    for (const e of mainWalkthrough.steps.flatMap((s) => s.entries))
      if (e.kind === "item") expect(knownItemIds.has(e.ref)).toBe(true);
  });

  test("tick ids of all entries cover every collectable and medal exactly once", () => {
    const ticks = mainWalkthrough.steps.flatMap((s) =>
      s.entries.flatMap((e) => entryTickIds("main", s.id, e)),
    );
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  test("post-game items are gathered in the post-game chapter", () => {
    const post = mainWalkthrough.steps.find((s) => s.chapterId === "postgame");
    expect(post).toBeTruthy();
    const refs = post!.entries.flatMap((e) => (e.kind === "item" ? [e.ref] : []));
    expect(new Set(refs)).toEqual(new Set(checklist.filter((i) => i.postgame).map((i) => i.id)));
  });

  test("steps keep their chapter and section placement", () => {
    for (const s of mainWalkthrough.steps) {
      expect(s.chapterId).toBeTruthy();
      if (s.sectionId)
        expect(sections.find((x) => x.id === s.sectionId)?.chapterId).toBe(s.chapterId);
    }
  });
});

describe("legacy conversion", () => {
  test("all built-in build guides convert to valid guides whose derived cost matches the original", () => {
    expect(curatedGuides.length).toBeGreaterThan(0);
    for (const legacy of curatedGuides) {
      const g = fromLegacyGuide(legacy);
      expect(guideSchema.safeParse(g).success, g.id).toBe(true);
      const derived = deriveBuild(g);
      expect(derived.errors, g.id).toEqual([]);
      for (const d of derived.steps.values()) expect(d.errors, `${g.id} ${d.stepId}`).toEqual([]);
      // The legacy total also counts the start weapon's purchase price; ABS must match exactly.
      expect(derived.total.abs, g.id).toBe(legacy.totals.abs);
      expect(g.steps).toHaveLength(legacy.steps.length);
    }
  });

  test("derived stats equal the stats stored in the legacy guide", () => {
    const legacy = curatedGuides[0];
    const derived = deriveBuild(fromLegacyGuide(legacy));
    legacy.steps.forEach((s) => {
      const d = derived.steps.get(s.id)!;
      expect(d.stats).toEqual(s.stats);
      expect(d.level).toBe(s.level);
      expect(d.sp).toBe(s.spLeft);
    });
  });

  test("walkthroughs convert to text steps and keep ids so ticks carry over", () => {
    const w = emptyWalkthrough("Mine", 1000);
    w.steps = [
      {
        id: "s1",
        chapterId: "c1",
        title: "T",
        notes: "n",
        checklist: [{ id: "i1", text: "Clock" }],
      },
    ];
    const g = fromLegacyWalkthrough(w);
    expect(guideSchema.safeParse(g).success).toBe(true);
    expect(g.steps[0].entries).toEqual([{ kind: "text", id: "i1", text: "Clock" }]);
    expect(migrateTickId(`wt:${w.id}:s1:i1`)).toBe(textTickId(w.id, "s1", "i1"));
    expect(migrateTickId(`wt:${w.id}:s1`)).toBe(`g:${w.id}:s1`);
    expect(migrateTickId(`guide:custom-a:s2`)).toBe("g:custom-a:s2");
    expect(migrateTickId("c1-scoop-brave-little-linda")).toBe("c1-scoop-brave-little-linda");
  });
});

describe("deriveBuild", () => {
  test("a guide without build steps derives nothing", () => {
    expect(deriveBuild(mainWalkthrough).steps.size).toBe(0);
  });

  test("reports per-step errors when an edited build no longer works", () => {
    const g = fromLegacyGuide(curatedGuides[0]);
    // Drop all synths from the second stage so its build-up requirements can't be met.
    const broken = structuredClone(g);
    broken.steps[1].build!.synths = [];
    broken.steps[1].build!.levelTo = 0;
    const d = deriveBuild(broken);
    expect([...d.steps.values()].some((x) => x.errors.length > 0)).toBe(true);
  });

  test("a build guide without a start weapon is reported", () => {
    const g = fromLegacyGuide(curatedGuides[0]);
    const { build: _drop, ...rest } = g;
    expect(deriveBuild(rest as typeof g).errors.length).toBeGreaterThan(0);
  });
});

describe("appendPlanToGuide", () => {
  test("continues a build guide from where it ends and the result derives without errors", async () => {
    const { planPath } = await import("@/lib/planner/plan");
    const { planResultToGuide, appendPlanToGuide } = await import("./fromPlan");
    const { getWeapon } = await import("@/lib/planner/sources");
    const { freshState } = await import("@/lib/weapons/mechanics");
    const start = freshState(getWeapon("battle-wrench"));
    const make = async (from: typeof start, target: string) => {
      const result = await planPath({
        start: from,
        targetId: target,
        objective: "abs",
        goal: { kind: "reach" },
        maxChapter: 3,
        spBonus: 1,
      });
      return {
        result,
        guide: planResultToGuide({ title: target, result, start: from, spBonus: 1 }),
      };
    };
    const first = await make(start, "drill-wrench");
    const d1 = deriveBuild(first.guide);
    expect(d1.errors).toEqual([]);
    const second = await make(d1.final!, "smash-wrench");
    const combined = appendPlanToGuide(first.guide, second.guide, "Both");
    const d = deriveBuild(combined);
    expect(d.errors).toEqual([]);
    for (const s of d.steps.values()) expect(s.errors).toEqual([]);
    expect(combined.steps.at(-1)!.build!.weaponId).toBe("smash-wrench");
    expect(d.final!.weaponId).toBe("smash-wrench");
  }, 120000);
});
