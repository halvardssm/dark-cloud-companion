// Profile/state schema for the unified guide model (state version 2) and the migration from version 1.
import { z } from "zod";
import {
  appState as appStateV1,
  type AppState as AppStateV1,
  type Profile as ProfileV1,
} from "@/lib/profiles";
import { fromLegacyGuide, fromLegacyWalkthrough, migrateTickId } from "./legacy";
import { MAIN_GUIDE_ID } from "./main";
import { guide, type Guide } from "./types";

export const STATE_VERSION_2 = 2;

export const dashboardView = z.enum(["chapter", "overview", "byGuide"]);
export type DashboardView = z.infer<typeof dashboardView>;

export const viewSettingsV2 = z.object({
  hideDone: z.boolean(),
  hidePostgame: z.boolean(),
  /** Show section facts (enemies, totals, medals) inside steps. */
  showFacts: z.boolean(),
});

export const profileV2 = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.number(),
  /** Ticks: data item ids, medal ids, and `g:<guide>:<step>[:<entry>]` for steps and text entries. */
  checks: z.record(z.string(), z.literal(true)),
  view: viewSettingsV2,
  /** Guides switched on (built-in ids and the ids of the user's own guides). */
  activeGuides: z.array(z.string()),
  /** The user's own guides, including hand-made, pinned and imported ones. */
  guides: z.array(guide),
  dashboard: z.object({
    view: dashboardView,
    /** Chapter shown by the dashboard's chapter view; null follows progress. */
    currentChapter: z.string().nullable(),
  }),
});
export type ProfileV2 = z.infer<typeof profileV2>;

export const appStateV2 = z.object({
  version: z.literal(STATE_VERSION_2),
  activeProfile: z.string(),
  profiles: z.record(z.string(), profileV2),
});
export type AppStateV2 = z.infer<typeof appStateV2>;

export function migrateProfile(p: ProfileV1): ProfileV2 {
  const guides: Guide[] = [
    ...p.customGuides.map((g) => fromLegacyGuide(g)),
    ...p.walkthroughs.map(fromLegacyWalkthrough),
  ];
  const checks = Object.fromEntries(
    Object.keys(p.checks).map((k) => [migrateTickId(k), true as const]),
  );
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    checks,
    view: {
      hideDone: p.view.hideDone,
      hidePostgame: p.view.hidePostgame,
      showFacts: p.view.layers.facts,
    },
    // The main walkthrough is on by default, including for migrated profiles.
    activeGuides: [...new Set([MAIN_GUIDE_ID, ...p.activeGuides])],
    guides,
    dashboard: { view: "chapter", currentChapter: null },
  };
}

export function migrateState(s: AppStateV1): AppStateV2 {
  return {
    version: STATE_VERSION_2,
    activeProfile: s.activeProfile,
    profiles: Object.fromEntries(
      Object.entries(s.profiles).map(([id, p]) => [id, migrateProfile(p)]),
    ),
  };
}

export function createProfileV2(name: string, now = Date.now()): ProfileV2 {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `p${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    checks: {},
    view: { hideDone: false, hidePostgame: false, showFacts: true },
    activeGuides: [MAIN_GUIDE_ID],
    guides: [],
    dashboard: { view: "chapter", currentChapter: null },
  };
}

/** Reads persisted JSON of either version; falls back to a fresh state. */
export function parseStateAnyVersion(raw: string | null): AppStateV2 {
  const fresh = () => {
    const p = createProfileV2("Playthrough 1");
    return {
      version: STATE_VERSION_2,
      activeProfile: p.id,
      profiles: { [p.id]: p },
    } satisfies AppStateV2;
  };
  if (!raw) return fresh();
  try {
    const data = JSON.parse(raw);
    const v2 = appStateV2.safeParse(data);
    if (v2.success && v2.data.profiles[v2.data.activeProfile]) return v2.data;
    const v1 = appStateV1.safeParse(data);
    if (v1.success && v1.data.profiles[v1.data.activeProfile]) return migrateState(v1.data);
  } catch {}
  return fresh();
}
