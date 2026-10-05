import { atom, computed } from "nanostores";
import {
  STATE_VERSION,
  STORAGE_KEY,
  createProfile,
  exportFile,
  importProfiles,
  initialState,
  parseState,
  type AppState,
  type ExportFile,
  type Profile,
  type ViewSettings,
} from "./profiles";

export const $state = atom<AppState>(initialState());
/** False until localStorage has been read on the client (avoid hydration flashes). */
export const $ready = atom(false);

export const $profile = computed($state, (s) => s.profiles[s.activeProfile]);
export const $checks = computed($profile, (p) => p.checks);

function persist(s: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

if (typeof window !== "undefined") {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {}
  $state.set(parseState(raw));
  $ready.set(true);
  $state.listen(persist);
  // Keep tabs in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) $state.set(parseState(e.newValue));
  });
}

function updateProfile(fn: (p: Profile) => Profile) {
  const s = $state.get();
  const p = s.profiles[s.activeProfile];
  $state.set({ ...s, profiles: { ...s.profiles, [p.id]: fn(p) } });
}

export function setChecked(id: string, checked: boolean) {
  updateProfile((p) => {
    const checks = { ...p.checks };
    if (checked) checks[id] = true;
    else delete checks[id];
    return { ...p, checks };
  });
}

export function setView(
  patch: Partial<Omit<ViewSettings, "layers">> & { layers?: Partial<ViewSettings["layers"]> },
) {
  updateProfile((p) => ({
    ...p,
    view: { ...p.view, ...patch, layers: { ...p.view.layers, ...patch.layers } },
  }));
}

export function toggleGuide(id: string, on: boolean) {
  updateProfile((p) => ({
    ...p,
    activeGuides: on
      ? [...new Set([...p.activeGuides, id])]
      : p.activeGuides.filter((g) => g !== id),
  }));
}

export function addProfile(name: string) {
  const p = createProfile(name);
  const s = $state.get();
  $state.set({ ...s, activeProfile: p.id, profiles: { ...s.profiles, [p.id]: p } });
}

export function switchProfile(id: string) {
  const s = $state.get();
  if (s.profiles[id]) $state.set({ ...s, activeProfile: id });
}

export function renameProfile(id: string, name: string) {
  const s = $state.get();
  if (!s.profiles[id] || !name.trim()) return;
  $state.set({ ...s, profiles: { ...s.profiles, [id]: { ...s.profiles[id], name: name.trim() } } });
}

export function deleteProfile(id: string) {
  const s = $state.get();
  const ids = Object.keys(s.profiles);
  if (ids.length <= 1 || !s.profiles[id]) return;
  const { [id]: _removed, ...rest } = s.profiles;
  $state.set({
    ...s,
    profiles: rest,
    activeProfile: s.activeProfile === id ? Object.keys(rest)[0] : s.activeProfile,
  });
}

export function buildExport(ids?: string[]): ExportFile {
  const s = $state.get();
  const profiles = (ids ?? Object.keys(s.profiles)).map((id) => s.profiles[id]).filter(Boolean);
  return { app: "dark-chronicles-companion", version: STATE_VERSION, profiles };
}

/** Returns an error message, or null on success. */
export function importFromJson(json: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return "Not valid JSON";
  }
  const parsed = exportFile.safeParse(data);
  if (!parsed.success) return "Not a Dark Chronicles Companion export";
  $state.set(importProfiles($state.get(), parsed.data));
  return null;
}
