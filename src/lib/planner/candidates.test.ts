import { describe, expect, test } from "vitest";
import { itemCandidates } from "./candidates";
import { itemAvailability, synthSources } from "./sources";

describe("buyable vs found-only items", () => {
  test("classification: shop items are buyable, drops and invention results are found-only", () => {
    expect(itemAvailability("Gunpowder")).toMatchObject({ kind: "buyable", price: 20 });
    expect(itemAvailability("Hunter Crystal").kind).toBe("buyable");
    expect(itemAvailability("Dark Coin").kind).toBe("buyable");
    expect(itemAvailability("Moon Stone")).toEqual({ kind: "found" });
    expect(itemAvailability("Missile Pod Arm")).toEqual({ kind: "found" });
    expect(itemAvailability("Level Up Powder")).toEqual({ kind: "found" });
  });

  test("every synth item is classified, and both groups are non-empty", () => {
    const kinds = synthSources.map((s) => itemAvailability(s.name).kind);
    expect(kinds.filter((k) => k === "buyable").length).toBeGreaterThan(60);
    expect(kinds.filter((k) => k === "found").length).toBeGreaterThan(20);
    // The planner's price field agrees with the classification.
    for (const s of synthSources)
      expect(s.price !== undefined).toBe(itemAvailability(s.name).kind === "buyable");
  });

  test("the planner only gets found-only items when they are allowed", () => {
    const strict = itemCandidates({ maxChapter: 8 });
    expect(strict.every((i) => itemAvailability(i.name).kind === "buyable")).toBe(true);
    const loose = itemCandidates({ maxChapter: 8, allowFound: true });
    expect(loose.some((i) => itemAvailability(i.name).kind === "found")).toBe(true);
    // Moon/Sun Stone stay out either way (not obtainable as a normal item).
    expect(loose.some((i) => /^(Moon|Sun) Stone$/.test(i.name))).toBe(false);
  });
});
