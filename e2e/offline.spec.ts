import { expect, test } from "@playwright/test";
import { targetPicker } from "./helpers";

test("the app works offline after the first visit", async ({ page, context }) => {
  await page.goto("/");
  // Wait for the service worker to take control and finish precaching.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 100; i++) {
      const keys = await caches.keys();
      if (keys.length) {
        const cache = await caches.open(keys[0]);
        if ((await cache.keys()).length > 100) return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.goto("/guides");
  await expect(page.getByRole("heading", { name: "Guides", exact: true })).toBeVisible();
  await page.goto("/weapons/poison-wrench");
  await expect(page.getByRole("heading", { name: "Poison Wrench" })).toBeVisible();
  // A client-only page with a query string is served from the same cached file.
  await page.goto("/guides/view?id=main");
  await expect(page.getByRole("heading", { name: "Main walkthrough" })).toBeVisible();
});

test("the planner still runs offline (solver bundled)", async ({ page, context }) => {
  await page.goto("/planner");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 100; i++) {
      const keys = await caches.keys();
      if (keys.length && (await (await caches.open(keys[0])).keys()).length > 100) return;
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await targetPicker(page).getByRole("button", { name: "Drill Wrench", exact: true }).click();
  await page.getByRole("button", { name: "Generate plan" }).click();
  await expect(page.getByText(/Build-up route:/)).toBeVisible({ timeout: 60_000 });
});
