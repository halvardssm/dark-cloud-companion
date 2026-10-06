import { BuildStepBody } from "@/components/guide/BuildStepBody";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { deriveBuild } from "@/lib/guide/derive";
import type { Guide } from "@/lib/guide/types";
import { getWeapon } from "@/lib/planner/sources";

/** Read-only preview of a generated guide's build steps (nothing is saved). */
export function PlanPreview({ guide }: { guide: Guide }) {
  const t = useTranslations();
  const derived = deriveBuild(guide);
  const route = [...new Set(guide.steps.flatMap((s) => (s.build ? [s.build.weaponId] : [])))];
  const last = guide.steps.filter((s) => s.build).at(-1)?.build?.weaponId;
  if (last && !route.includes(last)) route.push(last);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge>
          {t("planner.totalAbs", { n: Math.round(derived.total.abs).toLocaleString() })}
        </Badge>
        <Badge variant="secondary">
          {t("planner.totalGilda", { n: Math.round(derived.total.gilda).toLocaleString() })}
        </Badge>
        <Badge variant="outline">{t("planner.totalSteps", { n: derived.total.steps })}</Badge>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">{t("planner.route")}: </span>
        {route.map((id) => getWeapon(id).name).join(" → ")}
      </p>
      <ol className="flex flex-col gap-3">
        {guide.steps.map((s, i) => (
          <li key={s.id}>
            <Card size="sm">
              <CardHeader>
                <CardTitle>
                  {i + 1}. {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BuildStepBody step={s} derived={derived.steps.get(s.id)} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
