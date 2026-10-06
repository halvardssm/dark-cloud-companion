import { describe, expect, test } from "vitest";
import { generateTemplates } from "./templates";

describe("generateTemplates", () => {
  test("maxAuxBuildUps: 0 returns only direct sphere weapons, never chained ones", async () => {
    const templates = await generateTemplates({
      maxChapter: 8,
      allowFound: true,
      spBonus: 1,
      maxAuxBuildUps: 0,
    });
    expect(templates.length).toBeGreaterThan(0);
    // Chained templates are named "<chain joined by >>".
    expect(templates.some((t) => t.id.includes(">"))).toBe(false);
  }, 30000);

  test("chained templates appear with the default option set", async () => {
    const templates = await generateTemplates({ maxChapter: 8, allowFound: true, spBonus: 1 });
    expect(templates.some((t) => t.id.includes(">"))).toBe(true);
  }, 30000);
});
