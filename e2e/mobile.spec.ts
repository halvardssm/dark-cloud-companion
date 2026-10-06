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
    // On phones the sidebar lives in a sheet behind the header's trigger button; on desktop it
    // is already visible and the trigger would collapse it instead. Breadcrumb page crumbs are
    // exposed as links too, so probe with a label that only exists in the sidebar itself.
    const openSidebar = async () => {
      if (!(await page.getByRole("link", { name: "Ridepod" }).isVisible())) {
        // The header trigger (not the identically-labelled drag rail) opens the sidebar sheet.
        await page.locator("header").getByRole("button", { name: "Toggle Sidebar" }).click();
      }
    };
    for (const name of ["Guides", "Planner"]) {
      await openSidebar();
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    }
    await openSidebar();
    await page.getByRole("link", { name: "Items" }).click();
    await expect(page.getByRole("heading", { name: "Items", level: 1 })).toBeVisible();
  });
});
