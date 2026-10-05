import { describe, expect, test } from "vitest";
import ridepodRaw from "./ridepod.json";
import monstersRaw from "./monsters.json";
import { monstersData, ridepodData } from "./minigames-schema";
import { ingredientIdByName } from "@/lib/data";

const ridepod = ridepodData.parse(ridepodRaw);
const monsters = monstersData.parse(monstersRaw);

describe("ridepod data", () => {
  test("part counts per category match the source (5 families × 4 weapons, 8 armors, 9 legs, 6 packs)", () => {
    const n = (c: string) => ridepod.parts.filter((p) => p.category === c).length;
    expect([n("short"), n("long"), n("armor"), n("legs"), n("pack")]).toEqual([20, 20, 8, 9, 6]);
  });

  test("every part has a 3-ingredient recipe and resources", () => {
    for (const p of ridepod.parts) {
      expect(p.invent, p.name).toHaveLength(3);
      expect(p.resources.length, p.name).toBeGreaterThan(0);
    }
  });

  test("ids are unique; 7 cores and 21 shield kits", () => {
    expect(new Set(ridepod.parts.map((p) => p.id)).size).toBe(ridepod.parts.length);
    expect(ridepod.cores).toHaveLength(7);
    expect(ridepod.shieldKitCosts).toHaveLength(21);
  });

  test("recipe ingredients are known ideas or scoops", () => {
    const missing = ridepod.parts.flatMap((p) =>
      [...p.invent, ...(p.alternate ?? [])]
        .filter((i) => !ingredientIdByName.has(i.name.toLowerCase()))
        .map((i) => `${p.name}: ${i.name}`),
    );
    expect(missing).toEqual([]);
  });
});

describe("monster data", () => {
  test("10 classes, every evolution target exists in its class", () => {
    expect(monsters).toHaveLength(10);
    for (const c of monsters) {
      const names = new Set(c.forms.map((f) => f.name));
      for (const f of c.forms)
        for (const t of f.evolvesTo) expect(names.has(t), `${c.name}: ${t}`).toBe(true);
    }
  });
});
