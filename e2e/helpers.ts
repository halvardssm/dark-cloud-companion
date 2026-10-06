import type { Page } from "@playwright/test";

/** The app's persisted state (localStorage), parsed. */
export const readState = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("dcc:state");
    return raw ? JSON.parse(raw) : null;
  });

export const activeProfile = async (page: Page) => {
  const s = await readState(page);
  return s.profiles[s.activeProfile];
};

/** A profile exactly as the first (pre-guides) version of the app stored it. */
export const v1State = {
  version: 1,
  activeProfile: "p1",
  profiles: {
    p1: {
      id: "p1",
      name: "Old playthrough",
      createdAt: 1,
      checks: { "c1-scoop-brave-little-linda": true },
      view: {
        layers: { checklists: true, facts: true, walkthrough: true },
        hideDone: false,
        hidePostgame: false,
      },
      activeGuides: [],
      customGuides: [],
      walkthroughs: [
        {
          id: "wt-old",
          title: "My old walkthrough",
          createdAt: 1,
          updatedAt: 1,
          steps: [
            {
              id: "s1",
              chapterId: "c1",
              title: "Photos",
              notes: "",
              checklist: [{ id: "i1", text: "Clock" }],
            },
          ],
        },
      ],
    },
  },
};

/**
 * Navigate and wait until every Astro island has hydrated. Server-rendered content is visible before React takes
 * over, and interacting with it in that window loses events.
 */
export async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(
    () => ![...document.querySelectorAll("astro-island")].some((i) => i.hasAttribute("ssr")),
  );
}
