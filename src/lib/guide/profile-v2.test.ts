import { describe, expect, test } from "vitest";
import { curatedGuides } from "@/lib/guides/data";
import { createProfile, initialState } from "@/lib/profiles";
import { planToGuide } from "@/lib/guides/fromPlan";
import { planPath } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";
import { emptyWalkthrough } from "@/lib/walkthroughs/types";
import { deriveBuild } from "./derive";
import { appStateV2, createProfileV2, migrateProfile, parseStateAnyVersion } from "./profile-v2";

async function legacyProfile() {
  const p = createProfile("Old", 5);
  const result = await planPath({
    start: freshState(getWeapon("battle-wrench")),
    targetId: "drill-wrench",
    objective: "abs",
    goal: { kind: "reach" },
    maxChapter: 2,
    spBonus: 1,
  });
  const g = planToGuide({ id: "custom-a", title: "Mine", kind: "custom", summary: "s", result });
  const w = emptyWalkthrough("Route", 10);
  w.steps = [
    { id: "s1", chapterId: "c1", title: "T", notes: "", checklist: [{ id: "i1", text: "Clock" }] },
  ];
  return {
    ...p,
    customGuides: [g],
    walkthroughs: [w],
    activeGuides: ["custom-a", w.id, curatedGuides[0].id],
    checks: {
      "c1-scoop-brave-little-linda": true as const,
      "guide:custom-a:s1": true as const,
      [`wt:${w.id}:s1`]: true as const,
      [`wt:${w.id}:s1:i1`]: true as const,
    },
    view: { ...p.view, hideDone: true },
  };
}

describe("profile migration v1 -> v2", () => {
  test("merges custom guides and walkthroughs into guides and rewrites ticks", async () => {
    const old = await legacyProfile();
    const next = migrateProfile(old);
    expect(next.guides.map((g) => g.id)).toEqual(["custom-a", old.walkthroughs[0].id]);
    expect(Object.keys(next.checks).sort()).toEqual(
      [
        "c1-scoop-brave-little-linda",
        "g:custom-a:s1",
        `g:${old.walkthroughs[0].id}:s1`,
        `g:${old.walkthroughs[0].id}:s1:i1`,
      ].sort(),
    );
    expect(next.view).toEqual({ hideDone: true, hidePostgame: false, showFacts: true });
    // Main walkthrough on by default, existing toggles kept.
    expect(next.activeGuides[0]).toBe("main");
    expect(next.activeGuides).toContain("custom-a");
    expect(next.dashboard).toEqual({ view: "chapter", currentChapter: null });
  }, 60000);

  test("the migrated build guide still derives without errors", async () => {
    const next = migrateProfile(await legacyProfile());
    const g = next.guides.find((x) => x.id === "custom-a")!;
    expect(deriveBuild(g).errors).toEqual([]);
  }, 60000);

  test("a full v1 state parses into a valid v2 state; a v2 state round-trips; garbage resets", async () => {
    const v1 = initialState();
    const migrated = parseStateAnyVersion(JSON.stringify(v1));
    expect(appStateV2.safeParse(migrated).success).toBe(true);
    expect(migrated.profiles[migrated.activeProfile].activeGuides).toContain("main");
    expect(parseStateAnyVersion(JSON.stringify(migrated))).toEqual(migrated);
    expect(Object.keys(parseStateAnyVersion("nope").profiles)).toHaveLength(1);
  });

  test("new profiles start with the main walkthrough on", () => {
    expect(createProfileV2("x").activeGuides).toEqual(["main"]);
  });
});
