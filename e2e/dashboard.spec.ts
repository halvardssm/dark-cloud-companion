import { expect, test } from "@playwright/test";
import { activeProfile, v1State, go } from "./helpers";

test.describe("dashboard and progress", () => {
  test("ticking a collectable persists across reloads", async ({ page }) => {
    await go(page, "/");
    const linda = page.getByRole("checkbox", { name: /Brave Little Linda/ }).first();
    await expect(linda).not.toBeChecked();
    await linda.click();
    await expect(linda).toBeChecked();
    expect((await activeProfile(page)).checks["c1-scoop-brave-little-linda"]).toBe(true);
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Brave Little Linda/ }).first()).toBeChecked();
  });

  test("progress is shown only for switched-on guides", async ({ page }) => {
    await go(page, "/guides");
    const main = page.locator('[data-slot="card"]', { hasText: "Main walkthrough" });
    await main.getByRole("switch").click();
    await go(page, "/");
    await expect(page.getByText("No guides are switched on")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);

    // Overview still lists every chapter.
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByRole("button", { name: /To the Outside World/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Palace of Flowers/ })).toBeVisible();

    await go(page, "/guides");
    await page
      .locator('[data-slot="card"]', { hasText: "Main walkthrough" })
      .getByRole("switch")
      .click();
    await go(page, "/");
    await expect(page.getByRole("progressbar", { name: "Main walkthrough" })).toBeVisible();
  });

  test("the chapter view follows the picker and shows missable items", async ({ page }) => {
    await go(page, "/");
    await expect(page.getByText("Missable items still open")).toBeVisible();
    await page
      .getByLabel("Chapter", { exact: true })
      .selectOption({ label: "2. Ressurection of the Great Elder" });
    await expect(
      page.getByRole("heading", { name: /Ressurection of the Great Elder/ }),
    ).toBeVisible();
    await expect(page.getByText("King Mardan").first()).toBeVisible();
  });

  test("a profile saved by the first version of the app is migrated, keeping progress and walkthroughs", async ({
    page,
  }) => {
    await page.addInitScript((state) => {
      if (!localStorage.getItem("dcc:state"))
        localStorage.setItem("dcc:state", JSON.stringify(state));
    }, v1State);
    await go(page, "/");
    await expect(page.getByRole("checkbox", { name: /Brave Little Linda/ }).first()).toBeChecked();
    // Any change writes the migrated (version 2) state back.
    await page.getByRole("tab", { name: "Overview" }).click();
    await page.getByRole("tab", { name: "By guide" }).click();
    const p = await activeProfile(page);
    expect(p.activeGuides).toContain("main");
    expect(p.guides.map((g: { id: string }) => g.id)).toContain("wt-old");
  });

  test("buyable-only is a dashboard toggle that starts on", async ({ page }) => {
    await go(page, "/");
    const toggle = page.getByRole("switch", { name: "Only buyable items" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    expect((await activeProfile(page)).view.buyableOnly).toBe(false);
  });
});
