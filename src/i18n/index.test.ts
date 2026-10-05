import { expect, test } from "vitest";
import { useTranslations } from "./index";

test("translates known keys", () => {
  expect(useTranslations()("nav.planner")).toBe("Planner");
});
