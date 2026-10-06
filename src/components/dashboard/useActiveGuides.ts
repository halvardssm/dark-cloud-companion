import { useStore } from "@nanostores/react";
import { useMemo } from "react";
import { builtinGuideById, findGuide } from "@/lib/guide/builtin";
import type { Guide } from "@/lib/guide/types";
import { $checks, $profile } from "@/lib/store";

/** The profile's switched-on guides (missing ids are ignored), plus the profile and ticks. */
export function useActiveGuides() {
  const profile = useStore($profile);
  const checks = useStore($checks);
  const guides = useMemo(
    () =>
      profile.activeGuides
        .map((id) => findGuide(id, profile.guides))
        .filter((g): g is Guide => !!g),
    [profile.activeGuides, profile.guides],
  );
  return {
    profile,
    checks,
    guides,
    mainActive: profile.activeGuides.includes("main") && builtinGuideById.has("main"),
  };
}
