import { expect, test } from "@playwright/test";
import { go } from "./helpers";

const pages = [
  "/",
  "/guides",
  "/planner",
  "/weapons",
  "/weapons/poison-wrench",
  "/items",
  "/ridepod",
  "/monsters",
  "/spheda",
  "/settings",
  "/about",
];

test.describe("phone layout", () => {
  for (const path of pages) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await go(page, path);
      await page.waitForLoadState("networkidle");
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }

  test("every main tab is reachable", async ({ page }) => {
    await go(page, "/");
    for (const name of ["Guides", "Planner"]) {
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    }
    await page.getByRole("button", { name: /Reference/ }).click();
    await page.getByRole("menuitem", { name: "Items" }).click();
    await expect(page.getByRole("heading", { name: "Items", level: 1 })).toBeVisible();
  });
});
