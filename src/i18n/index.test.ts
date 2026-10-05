import { expect, test } from "vitest";
import { useTranslations } from "./index";

test("translates known keys", () => {
  expect(useTranslations()("nav.planner")).toBe("Planner");
});

test("interpolates variables", () => {
  expect(useTranslations()("chapter.progress", { done: 3, total: 9 })).toBe("3 / 9");
});
