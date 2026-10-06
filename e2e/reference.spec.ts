import { expect, test } from "@playwright/test";
import { go, targetPicker } from "./helpers";

test.describe("reference pages", () => {
  test("items can be filtered by buyable / found-only", async ({ page }) => {
    await go(page, "/items");
    await page.getByLabel("Items", { exact: true }).selectOption("found");
    await expect(page.getByText("Moon Stone", { exact: true })).toBeVisible();
    await expect(page.getByText("Gunpowder", { exact: true })).toHaveCount(0);
    await page.getByLabel("Items", { exact: true }).selectOption("buyable");
    await expect(page.getByText("Gunpowder", { exact: true })).toBeVisible();
    await expect(page.getByText("Moon Stone", { exact: true })).toHaveCount(0);
  });

  test("weapon pages show build-up links and a planner deep link", async ({ page }) => {
    await go(page, "/weapons/poison-wrench");
    await expect(page.getByRole("heading", { name: "Poison Wrench" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sigma Breaker" })).toBeVisible();
    await page.getByRole("link", { name: "Plan a build-up to this weapon" }).click();
    await expect(
      targetPicker(page).getByRole("button", { name: "Poison Wrench", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("Ridepod parts can be ticked", async ({ page }) => {
    await go(page, "/ridepod");
    // The close-range arms section starts open.
    const box = page.getByRole("checkbox", { name: /^Cannonball Arm/ }).first();
    await box.click();
    await expect(box).toBeChecked();
  });

  test("old chapter URLs redirect to the dashboard", async ({ page }) => {
    await go(page, "/chapters/c3");
    await expect(page).toHaveURL(/\/\?chapter=c3$/);
    await expect(page.getByRole("heading", { name: /The Sage of the Stars/ })).toBeVisible();
  });
});

test("the weapons list has one tab per weapon type", async ({ page }) => {
  await go(page, "/weapons");
  await expect(page.getByRole("tab")).toHaveCount(6); // All + 5 types
  await page.getByRole("tab", { name: "Armbands" }).click();
  await expect(page.getByRole("link", { name: /Five-Star Armlet/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Grade Zero/ })).toHaveCount(0);
});
