// Profile/state schema for the unified guide model (state version 2) and the migration from version 1.
// Version 1 lives in profiles-v1.ts and is only read for migration.
import { z } from "zod";
import {
  appState as appStateV1,
  exportFile as exportFileV1,
  type AppState as AppStateV1,
  type Profile as ProfileV1,
} from "./profiles-v1";
import { fromLegacyGuide, fromLegacyWalkthrough, migrateTickId } from "./guide/legacy";
import { MAIN_GUIDE_ID } from "./guide/main";
import { guide, type Guide } from "./guide/types";

export const STORAGE_KEY = "dcc:state";
export const STATE_VERSION = 2;

export const dashboardView = z.enum(["chapter", "overview", "byGuide"]);
export type DashboardView = z.infer<typeof dashboardView>;

export const viewSettings = z.object({
  hideDone: z.boolean(),
  hidePostgame: z.boolean(),
  /** Show section facts (enemies, totals, medals) inside steps. */
  showFacts: z.boolean(),
});

export const profile = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.number(),
  /** Ticks: data item ids, medal ids, and `g:<guide>:<step>[:<entry>]` for steps and text entries. */
  checks: z.record(z.string(), z.literal(true)),
  view: viewSettings,
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
export type Profile = z.infer<typeof profile>;

export const appState = z.object({
  version: z.literal(STATE_VERSION),
  activeProfile: z.string(),
  profiles: z.record(z.string(), profile),
});
export type AppState = z.infer<typeof appState>;

export function migrateProfile(p: ProfileV1): Profile {
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

export function migrateState(s: AppStateV1): AppState {
  return {
    version: STATE_VERSION,
    activeProfile: s.activeProfile,
    profiles: Object.fromEntries(
      Object.entries(s.profiles).map(([id, p]) => [id, migrateProfile(p)]),
    ),
  };
}

export function createProfile(name: string, now = Date.now()): Profile {
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
export function parseState(raw: string | null): AppState {
  const fresh = () => {
    const p = createProfile("Playthrough 1");
    return {
      version: STATE_VERSION,
      activeProfile: p.id,
      profiles: { [p.id]: p },
    } satisfies AppState;
  };
  if (!raw) return fresh();
  try {
    const data = JSON.parse(raw);
    const v2 = appState.safeParse(data);
    if (v2.success && v2.data.profiles[v2.data.activeProfile]) return v2.data;
    const v1 = appStateV1.safeParse(data);
    if (v1.success && v1.data.profiles[v1.data.activeProfile]) return migrateState(v1.data);
  } catch {}
  return fresh();
}

export type ViewSettings = z.infer<typeof viewSettings>;

export const initialState = (): AppState => {
  const p = createProfile("Playthrough 1");
  return { version: STATE_VERSION, activeProfile: p.id, profiles: { [p.id]: p } };
};

/** Export file wrapper (profiles including their progress). */
export const exportFile = z.object({
  app: z.literal("dark-chronicles-companion"),
  version: z.literal(STATE_VERSION),
  profiles: z.array(profile).min(1),
});
export type ExportFile = z.infer<typeof exportFile>;

/** Reads a profile export of either version; version 1 files are migrated. */
export function parseProfileExport(data: unknown): ExportFile | null {
  const v2 = exportFile.safeParse(data);
  if (v2.success) return v2.data;
  const v1 = exportFileV1.safeParse(data);
  if (v1.success) {
    return {
      app: "dark-chronicles-companion",
      version: STATE_VERSION,
      profiles: v1.data.profiles.map(migrateProfile),
    };
  }
  return null;
}

/** Merge imported profiles into state. Same-id profiles are replaced; others added. */
export function importProfiles(state: AppState, file: ExportFile): AppState {
  const profiles = { ...state.profiles };
  for (const p of file.profiles) profiles[p.id] = p;
  return { ...state, profiles, activeProfile: file.profiles[0].id };
}
