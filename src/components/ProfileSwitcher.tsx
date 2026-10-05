import { useStore } from "@nanostores/react";
import { useTranslations } from "@/i18n";
import { $ready, $state, switchProfile } from "@/lib/store";

/** Compact active-profile picker for the header. Hidden until the stored state has loaded. */
export function ProfileSwitcher() {
  const t = useTranslations();
  const ready = useStore($ready);
  const state = useStore($state);
  const profiles = Object.values(state.profiles);
  if (!ready || profiles.length < 2) return null;
  return (
    <select
      aria-label={t("nav.profile")}
      className="bg-background h-8 max-w-36 rounded-md border px-2 text-xs"
      value={state.activeProfile}
      onChange={(e) => switchProfile(e.target.value)}
    >
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
