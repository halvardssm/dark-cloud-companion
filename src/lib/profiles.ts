import { z } from "zod";

export const STORAGE_KEY = "dcc:state";
export const STATE_VERSION = 1;

export const viewSettings = z.object({
  /** Content layers (D10). Missable warnings ignore these. */
  layers: z.object({
    checklists: z.boolean(),
    facts: z.boolean(),
    walkthrough: z.boolean(),
  }),
  hideDone: z.boolean(),
  hidePostgame: z.boolean(),
});
export type ViewSettings = z.infer<typeof viewSettings>;

export const profile = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.number(),
  /** Checked ids: checklist item ids and generated medal ids. */
  checks: z.record(z.string(), z.literal(true)),
  view: viewSettings,
  activeGuides: z.array(z.string()),
});
export type Profile = z.infer<typeof profile>;

export const appState = z.object({
  version: z.literal(STATE_VERSION),
  activeProfile: z.string(),
  profiles: z.record(z.string(), profile),
});
export type AppState = z.infer<typeof appState>;

/** Export file wrapper so imports can tell what they are looking at. */
export const exportFile = z.object({
  app: z.literal("dark-chronicles-companion"),
  version: z.literal(STATE_VERSION),
  profiles: z.array(profile).min(1),
});
export type ExportFile = z.infer<typeof exportFile>;

export const defaultView = (): ViewSettings => ({
  layers: { checklists: true, facts: true, walkthrough: false },
  hideDone: false,
  hidePostgame: false,
});

export function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  );
}

export function createProfile(name: string, now = Date.now()): Profile {
  return { id: newId(), name, createdAt: now, checks: {}, view: defaultView(), activeGuides: [] };
}

export function initialState(): AppState {
  const p = createProfile("Playthrough 1");
  return { version: STATE_VERSION, activeProfile: p.id, profiles: { [p.id]: p } };
}

/** Parse persisted JSON; falls back to a fresh state when missing or invalid. */
export function parseState(raw: string | null): AppState {
  if (!raw) return initialState();
  try {
    const parsed = appState.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.profiles[parsed.data.activeProfile]) return parsed.data;
  } catch {}
  return initialState();
}

/** Merge imported profiles into state. Same-id profiles are replaced; others added. */
export function importProfiles(state: AppState, file: ExportFile): AppState {
  const profiles = { ...state.profiles };
  for (const p of file.profiles) profiles[p.id] = p;
  return { ...state, profiles, activeProfile: file.profiles[0].id };
}
