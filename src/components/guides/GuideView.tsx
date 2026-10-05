import { useStore } from "@nanostores/react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n";
import { stepCheckId } from "@/lib/guides/data";
import type { Guide } from "@/lib/guides/types";
import { getWeapon } from "@/lib/planner/sources";
import { $checks } from "@/lib/store";
import { GuideStepCard, RecipeView } from "./GuideStepCard";

/** Full guide: totals, route, and every step. Steps are checkable when `trackProgress` is set. */
export function GuideView({
  guide,
  trackProgress = false,
}: {
  guide: Guide;
  trackProgress?: boolean;
}) {
  const t = useTranslations();
  const checks = useStore($checks);
  const done = guide.steps.filter((s) => checks[stepCheckId(guide.id, s.id)]).length;
  const route = [
    ...new Set(
      guide.steps.flatMap((s) => [s.stage.weaponId, ...(s.buildsUpTo ? [s.buildsUpTo] : [])]),
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{t("planner.totalAbs", { n: Math.round(guide.totals.abs).toLocaleString() })}</Badge>
        <Badge variant="secondary">
          {t("planner.totalGilda", { n: Math.round(guide.totals.gilda).toLocaleString() })}
        </Badge>
        <Badge variant="outline">{t("planner.totalSteps", { n: guide.totals.steps })}</Badge>
        {trackProgress && (
          <Badge variant="outline">
            {t("guides.progress", { done, total: guide.steps.length })}
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{guide.summary}</p>
      <p className="text-sm">
        <span className="text-muted-foreground">{t("planner.route")}: </span>
        {route.map((id) => getWeapon(id).name).join(" → ")}
      </p>
      {guide.start && (
        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">{t("guides.start")}: </span>
            {getWeapon(guide.start.weaponId).name}
          </p>
          <RecipeView
            recipe={{
              acquire: guide.start.acquire,
              stages: [{ weaponId: guide.start.weaponId, levelTo: 0, synths: [] }],
            }}
          />
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {guide.steps.map((s, i) => (
          <li key={s.id}>
            <GuideStepCard
              step={s}
              index={i}
              checkId={trackProgress ? stepCheckId(guide.id, s.id) : undefined}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
