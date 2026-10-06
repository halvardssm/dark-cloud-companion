import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { activeProfile, go } from "./helpers";

test.describe("guides, planner and editor", () => {
  test("generate a weapon build, save it as a guide and see it in My guides", async ({ page }) => {
    await go(page, "/planner");
    await page.getByLabel("Target weapon").selectOption("smash-wrench");
    await page.getByRole("button", { name: "Generate plan" }).click();
    await expect(page.getByText(/Build-up route:/)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(/Battle Wrench → True Battle Wrench → Drill Wrench → Smash Wrench/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save as guide" }).click();
    await go(page, "/guides");
    await expect(page.getByRole("link", { name: "Smash Wrench — Least ABS" })).toBeVisible();
  });

  test("the planner remembers its inputs", async ({ page }) => {
    await go(page, "/planner");
    await page.getByLabel("Target weapon").selectOption("legend");
    await page.getByLabel("Optimise for").selectOption("gilda");
    await page.reload();
    await expect(page.getByLabel("Target weapon")).toHaveValue("legend");
    await expect(page.getByLabel("Optimise for")).toHaveValue("gilda");
  });

  test("create a guide by hand: text step, checklist items and a referenced collectable", async ({
    page,
  }) => {
    await go(page, "/planner?new");
    await page.getByLabel("Guide title").fill("My e2e guide");
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByLabel("Step title").fill("Photos in town");
    await page.getByPlaceholder("Add item (paste several lines to add several)").fill("Clock");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.getByPlaceholder("Search collectables by name").fill("Brave Little");
    await page.getByRole("button", { name: /Brave Little Linda/ }).click();
    await page.getByRole("button", { name: "Save guide" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const p = await activeProfile(page);
    const g = p.guides.find((x: { title: string }) => x.title === "My e2e guide");
    expect(g.steps[0].entries.map((e: { kind: string }) => e.kind)).toEqual(["text", "item"]);

    // Switch it on and tick its text item from the dashboard.
    await go(page, "/guides");
    await page
      .locator('[data-slot="card"]', { hasText: "My e2e guide" })
      .getByRole("switch")
      .click();
    await go(page, "/");
    await page.getByRole("tab", { name: "By guide" }).click();
    await page.getByRole("checkbox", { name: "Clock", exact: true }).click();
    expect(
      Object.keys((await activeProfile(page)).checks).some((k) =>
        k.endsWith(":" + g.steps[0].entries[0].id),
      ),
    ).toBe(true);
  });

  test("a built-in guide can be duplicated into an editable copy", async ({ page }) => {
    await go(page, "/guides");
    await page
      .locator('[data-slot="card"]', { hasText: "Grade Zero — Least ABS" })
      .first()
      .getByRole("button", { name: "Duplicate to edit" })
      .click();
    await expect(page.getByLabel("Guide title")).toHaveValue("Grade Zero — Least ABS (copy)");
    await expect(page.getByText("Weapon build", { exact: true }).first()).toBeVisible();
  });

  test("export and import round-trips; importing the same file again changes nothing", async ({
    page,
  }) => {
    await go(page, "/planner?new");
    await page.getByLabel("Guide title").fill("Round trip");
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("button", { name: "Save guide" }).click();
    await go(page, "/guides");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export all my guides" }).click(),
    ]);
    const path = await download.path();
    const file = JSON.parse(readFileSync(path, "utf8"));
    expect(file).toMatchObject({ app: "dark-chronicles-companion", kind: "content", version: 2 });
    expect(file.guides.map((g: { title: string }) => g.title)).toContain("Round trip");

    await page.locator('input[type="file"]').setInputFiles(path);
    await expect(page.getByText(/0 new, 0 kept as copies.*1 already present/)).toBeVisible();

    // A bad file is rejected without changing anything.
    await page.locator('input[type="file"]').setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ nope"),
    });
    await expect(page.getByText(/Import failed: Not valid JSON/)).toBeVisible();
  });
});
