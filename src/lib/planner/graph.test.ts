import { describe, expect, test } from "vitest";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "./graph";
import { getWeapon } from "./sources";

describe("finalWeaponIds", () => {
  test("the final weapons sit at the top SP tier at the end of a full build-up line", () => {
    for (const id of finalWeaponIds) {
      const w = getWeapon(id);
      expect(w.spPerLevel, id).toBe(6);
      // Not every final is a leaf: Griffon Fork builds up into Island King, yet the FAQ lists
      // both as endgame targets. What holds is that a whole line leads into each of them.
      expect(
        [...ancestorsOf(id)].some((a) => rootWeaponIds.has(a)),
        id,
      ).toBe(true);
    }
  });

  test("every type except clubs has a final weapon", () => {
    const types = new Set(finalWeaponIds.map((id) => getWeapon(id).type));
    expect([...types].sort()).toEqual(["armband", "gun", "sword", "wrench"]);
  });

  test("covers the weapon FAQ's endgame targets", () => {
    const names = finalWeaponIds.map((id) => getWeapon(id).name);
    expect(names).toEqual([
      "Island King",
      "Love",
      "Grade Zero",
      "LEGEND",
      "Supernova",
      "Last Resort",
      "Sigma Bazooka",
      "Dark Cloud",
      "Griffon Fork",
      "Five-Star Armlet",
    ]);
  });
});
