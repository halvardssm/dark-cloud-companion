import { describe, expect, test } from "vitest";
import { buildContentExport, mergeContent } from "./content-file";
import { parseContentImport } from "./content-transfer";
import { planToGuide } from "@/lib/guides/fromPlan";
import { planPath } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";
import { emptyWalkthrough, walkthroughProgress, type Walkthrough } from "@/lib/walkthroughs/types";
import type { Guide } from "@/lib/guides/types";

async function sampleGuide(): Promise<Guide> {
  const result = await planPath({
    start: freshState(getWeapon("battle-wrench")),
    targetId: "drill-wrench",
    objective: "abs",
    goal: { kind: "reach" },
    maxChapter: 2,
    spBonus: 1,
  });
  return planToGuide({ id: "custom-a", title: "Mine", kind: "custom", summary: "s", result });
}

function sampleWalkthrough(): Walkthrough {
  const w = emptyWalkthrough("My route", 1000);
  w.steps = [
    {
      id: "s1",
      chapterId: "c1",
      title: "Photos",
      notes: "Take a picture of the clock.",
      checklist: [
        { id: "i1", text: "Clock" },
        { id: "i2", text: "Belt" },
      ],
    },
    { id: "s2", chapterId: "c2", sectionId: "c2-strange", title: "Tree", notes: "", checklist: [] },
  ];
  return w;
}

const makeId = (old: string) => `${old}-copy`;

describe("content export/import", () => {
  test("round-trips guides and walkthroughs", async () => {
    const guide = await sampleGuide();
    const file = buildContentExport([guide], [sampleWalkthrough()]);
    const parsed = parseContentImport(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.guides).toHaveLength(1);
      expect(parsed.file.walkthroughs[0].steps[0].checklist.map((i) => i.text)).toEqual([
        "Clock",
        "Belt",
      ]);
    }
  }, 60000);

  test("only custom guides are exported", async () => {
    const guide = await sampleGuide();
    const file = buildContentExport([guide, { ...guide, id: "builtin", kind: "curated" }], []);
    expect(file.guides.map((g) => g.id)).toEqual(["custom-a"]);
  }, 60000);

  test("rejects invalid JSON, wrong files and profile exports", () => {
    expect(parseContentImport("nope")).toMatchObject({ ok: false });
    expect(parseContentImport("{}")).toMatchObject({ ok: false });
    const r = parseContentImport(
      JSON.stringify({ app: "dark-chronicles-companion", version: 1, profiles: [] }),
    );
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/profile export/i);
  });

  test("rejects walkthroughs that point at unknown chapters or sections", () => {
    const w = sampleWalkthrough();
    w.steps[0].chapterId = "c99";
    let r = parseContentImport(JSON.stringify(buildContentExport([], [w])));
    expect(r).toMatchObject({ ok: false });
    const w2 = sampleWalkthrough();
    w2.steps[1].sectionId = "c1-rats"; // exists, but belongs to chapter 1 not 2
    r = parseContentImport(JSON.stringify(buildContentExport([], [w2])));
    expect(r).toMatchObject({ ok: false });
  });

  test("rejects guides that reference unknown weapons or items", async () => {
    const guide = await sampleGuide();
    const bad = structuredClone(guide);
    bad.steps[0].stage.weaponId = "not-a-weapon";
    expect(parseContentImport(JSON.stringify(buildContentExport([bad], [])))).toMatchObject({
      ok: false,
    });
    const bad2 = structuredClone(guide);
    bad2.steps[0].stage.synths.push({ kind: "item", name: "Nonexistent Thing", count: 1 });
    expect(parseContentImport(JSON.stringify(buildContentExport([bad2], [])))).toMatchObject({
      ok: false,
    });
  }, 60000);
});

describe("mergeContent", () => {
  test("adds new, skips identical, copies changed items with the same id", () => {
    const w = sampleWalkthrough();
    const file = buildContentExport([], [w]);
    const first = mergeContent({ guides: [], walkthroughs: [] }, file, makeId);
    expect(first.summary).toEqual({ added: 1, copied: 0, skipped: 0 });

    const again = mergeContent({ guides: [], walkthroughs: first.walkthroughs }, file, makeId);
    expect(again.summary).toEqual({ added: 0, copied: 0, skipped: 1 });
    expect(again.walkthroughs).toHaveLength(1);

    const changed = { ...w, title: "Edited elsewhere" };
    const clash = mergeContent(
      { guides: [], walkthroughs: first.walkthroughs },
      buildContentExport([], [changed]),
      makeId,
    );
    expect(clash.summary).toEqual({ added: 0, copied: 1, skipped: 0 });
    expect(clash.walkthroughs.map((x) => x.id)).toEqual([w.id, `${w.id}-copy`]);
    expect(clash.walkthroughs[1].title).toMatch(/\(imported\)$/);
  });

  test("timestamps alone don't make two copies differ", () => {
    const w = sampleWalkthrough();
    const merged = mergeContent(
      { guides: [], walkthroughs: [w] },
      buildContentExport([], [{ ...w, updatedAt: w.updatedAt + 5 }]),
      makeId,
    );
    expect(merged.summary.skipped).toBe(1);
  });
});

test("walkthrough progress counts steps and checklist items", () => {
  const w = sampleWalkthrough();
  expect(walkthroughProgress(w, {})).toEqual({ done: 0, total: 4 });
  expect(walkthroughProgress(w, { [`wt:${w.id}:s1`]: true, [`wt:${w.id}:s1:i1`]: true })).toEqual({
    done: 2,
    total: 4,
  });
});
