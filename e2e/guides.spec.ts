import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { activeProfile, go, startPicker, targetPicker, typeTabs } from "./helpers";

test.describe("guides, planner and editor", () => {
  test("generate a weapon build, save it as a guide and see it in My guides", async ({ page }) => {
    await go(page, "/planner");
    await targetPicker(page).selectOption({ label: "Smash Wrench" });
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
    await targetPicker(page).selectOption({ label: "LEGEND" });
    await page.getByLabel("Optimise for").selectOption("gilda");
    await page.reload();
    await expect(targetPicker(page)).toHaveValue("legend");
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

test("remembered planner inputs that point at unknown weapons are ignored instead of breaking the page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const id = "p1";
    const stats = Object.fromEntries(
      ["at", "fl", "ch", "li", "cy", "sm", "ex", "be", "sc"].map((k) => [k, 0]),
    );
    localStorage.setItem(
      "dcc:state",
      JSON.stringify({
        version: 2,
        activeProfile: id,
        profiles: {
          [id]: {
            id,
            name: "Broken planner",
            createdAt: 1,
            checks: {},
            view: { hideDone: false, hidePostgame: false, showFacts: true, buyableOnly: true },
            activeGuides: ["main"],
            guides: [],
            dashboard: { view: "chapter", currentChapter: null },
            planner: {
              targetId: "no-such-weapon",
              objective: "abs",
              maxChapter: 3,
              budget: "",
              abilities: [],
              customStart: false,
              endLevel: 0,
              start: {
                weaponId: "gone-weapon",
                level: 0,
                abs: 0,
                stats,
                du: 0,
                sp: 0,
                abilities: [],
                spBonus: 1,
              },
            },
          },
        },
      }),
    );
  });
  await go(page, "/planner");
  await expect(targetPicker(page)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test.describe("custom start and end weapons, one tab per weapon type", () => {
  test("the target weapon is picked from weapon-type tabs", async ({ page }) => {
    await go(page, "/planner");
    // Wrenches (the first tab) are active by default, with the type's final weapon selected.
    await expect(typeTabs(page).getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
    await expect(targetPicker(page)).toHaveValue("grade-zero");
    await expect(targetPicker(page).getByRole("option", { name: "Grade Zero" })).toHaveCount(1);
    // The finals have their own tier at the top; the rest is grouped by SP tier, highest first.
    const groups = targetPicker(page).locator("optgroup");
    await expect(groups).toHaveCount(4);
    await expect(groups.first()).toHaveAttribute("label", "Final weapons");
    await expect(groups.first().locator("option")).toHaveText(["Grade Zero", "LEGEND"]);
    await expect(groups.nth(1)).toHaveAttribute("label", "6 SP per level");
    await expect(groups.last()).toHaveAttribute("label", "3 SP per level");
    await expect(targetPicker(page).locator("option").first()).toHaveText("Grade Zero");
    await expect(targetPicker(page).locator("option").last()).toHaveText("Turtle Shell Hammer");
    await typeTabs(page).getByRole("tab", { name: "Guns" }).click();
    // Switching tabs defaults to the type's alphabetically first final weapon (Last Resort,
    // before Sigma Bazooka and Supernova).
    await expect(targetPicker(page)).toHaveValue("last-resort");
    await expect(targetPicker(page).getByRole("option", { name: "Supernova" })).toHaveCount(1);
    await expect(targetPicker(page).getByRole("option", { name: "Grade Zero" })).toHaveCount(0);
    await targetPicker(page).selectOption({ label: "Supernova" });
    // A custom start point only offers weapons that can build up into the Supernova (guns).
    await page
      .getByRole("region", { name: "Start point" })
      .getByLabel("Choose the start point")
      .selectOption("custom");
    await expect(startPicker(page).getByRole("option", { name: "Steal Gun" })).toHaveCount(1);
    await expect(startPicker(page).getByRole("option", { name: "Grade Zero" })).toHaveCount(0);
  });

  test("custom start weapon (specs + abilities) and custom end weapon (required specs)", async ({
    page,
  }) => {
    await go(page, "/planner");
    await targetPicker(page).selectOption({ label: "Smash Wrench" });
    const startSection = page.getByRole("region", { name: "Start point" });
    const targetSection = page.getByRole("region", { name: "Target weapon" });
    // Selecting a target prefills its maximum stats; Min goes back to the weapon's base stats.
    await expect(targetSection.getByLabel(/^Flame ≤/)).toHaveValue("60");
    await targetSection.getByRole("button", { name: "Min", exact: true }).click();
    await expect(targetSection.getByLabel(/^Flame ≤/)).toHaveValue("20");
    await targetSection.getByRole("button", { name: "Max", exact: true }).click();
    await expect(targetSection.getByLabel(/^Flame ≤/)).toHaveValue("60");

    // Custom start weapon: a Battle Wrench that is already leveled and has a few stats.
    await startSection.getByLabel("Choose the start point").selectOption("custom");
    await startSection.getByLabel("Level", { exact: true }).fill("3");
    await startSection.getByLabel("Attack", { exact: true }).fill("14");
    await startSection.getByLabel("Poison", { exact: true }).check();

    // Custom end weapon: Smash Wrench with required minimum Flame and the Dark ability.
    await targetSection.getByRole("button", { name: "Min", exact: true }).click();
    await targetSection.getByLabel(/^Flame ≤/).fill("30");
    await targetSection.getByLabel("Dark", { exact: true }).check();
    await page.getByRole("button", { name: "Generate plan" }).click();
    await expect(page.getByText(/Build-up route:/)).toBeVisible({ timeout: 60_000 });

    const stored = await activeProfile(page);
    expect(stored.planner).toMatchObject({
      customStart: true,
      endStats: { fl: 30 },
      abilities: ["dark"],
    });
    expect(stored.planner.start).toMatchObject({ level: 3, abilities: ["poison"] });
    // The plan starts from the custom weapon, so its first stage doesn't level a fresh weapon from +0.
    await expect(page.getByText("Dark Coin").first()).toBeVisible();
  });
});
