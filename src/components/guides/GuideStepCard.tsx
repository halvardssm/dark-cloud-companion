import { useStore } from "@nanostores/react";
import { STAT_KEYS } from "@/data/weapons-schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations, type Translate } from "@/i18n";
import type { GuideStep } from "@/lib/guides/types";
import { getWeapon } from "@/lib/planner/sources";
import type { Acquire, Recipe, Stage } from "@/lib/planner/types";
import { $checks, setChecked } from "@/lib/store";

const name = (id: string) => getWeapon(id).name;

function acquireText(t: Translate, a: Acquire) {
  if (a.kind === "shop") return t("planner.acquire.shop", { shop: a.shop, price: a.price });
  if (a.kind === "invent") return t("planner.acquire.invent", { gilda: a.gilda });
  return t("planner.acquire.have");
}

type Group =
  | { kind: "item"; name: string; count: number }
  | { kind: "sphere"; recipe: Recipe; count: number };

/** Merges identical sphere recipes so "3 × Heavy Hammer +5" reads as one line. */
function groupSynths(stage: Stage): Group[] {
  const groups: Group[] = [];
  for (const s of stage.synths) {
    if (s.kind === "item") {
      groups.push({ kind: "item", name: s.name, count: s.count });
      continue;
    }
    const key = JSON.stringify(s.recipe);
    const same = groups.find((g) => g.kind === "sphere" && JSON.stringify(g.recipe) === key);
    if (same) same.count++;
    else groups.push({ kind: "sphere", recipe: s.recipe, count: 1 });
  }
  return groups;
}

export function RecipeView({ recipe }: { recipe: Recipe }) {
  const t = useTranslations();
  return (
    <ol className="text-muted-foreground mt-1 flex list-decimal flex-col gap-1 pl-5 text-xs">
      <li>
        {t("planner.step.acquire", { weapon: name(recipe.stages[0].weaponId) })}:{" "}
        {acquireText(t, recipe.acquire)}
      </li>
      {recipe.stages.map((s, i) => (
        <li key={i}>
          {name(s.weaponId)} +{s.levelTo}
          {s.synths.length > 0 &&
            ` · ${s.synths.map((x) => (x.kind === "item" ? `${x.count}× ${x.name}` : "sphere")).join(", ")}`}
          {i < recipe.stages.length - 1 &&
            ` → ${t("planner.step.buildup", { weapon: name(recipe.stages[i + 1].weaponId) })}`}
        </li>
      ))}
    </ol>
  );
}

interface Props {
  step: GuideStep;
  index: number;
  /** When set, the step gets a completion checkbox stored in the profile. */
  checkId?: string;
  /** Extra badge text (e.g. "carried over from chapter 3"). */
  note?: string;
  showChapter?: boolean;
}

export function GuideStepCard({ step, index, checkId, note, showChapter = true }: Props) {
  const t = useTranslations();
  const checks = useStore($checks);
  const done = checkId ? !!checks[checkId] : false;
  const { stage } = step;
  const groups = groupSynths(stage);
  const last = (r: Recipe) => r.stages[r.stages.length - 1];

  return (
    <Card size="sm" className={done ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {checkId && (
            <Checkbox
              checked={done}
              onCheckedChange={(v) => setChecked(checkId, v === true)}
              aria-label={name(stage.weaponId)}
            />
          )}
          <span>
            {index + 1}. {name(stage.weaponId)}
          </span>
          {showChapter && (
            <Badge variant="outline">{t("guides.stepChapter", { n: step.chapter })}</Badge>
          )}
          {note && <Badge variant="secondary">{note}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {stage.levelTo > 0 && (
          <p>
            {t("planner.step.level", {
              weapon: name(stage.weaponId),
              to: stage.levelTo,
              abs: Math.round(step.abs).toLocaleString(),
            })}
          </p>
        )}
        {groups.map((g, i) =>
          g.kind === "item" ? (
            <p key={i}>{t("planner.step.itemFree", { count: g.count, name: g.name })}</p>
          ) : (
            <div key={i}>
              <p>
                {t(g.count > 1 ? "planner.step.sphereCount" : "planner.step.sphere", {
                  count: g.count,
                  weapon: name(last(g.recipe).weaponId),
                  level: last(g.recipe).levelTo,
                  sp: last(g.recipe).levelTo,
                })}
              </p>
              <details>
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  {t("planner.step.prepare")}
                </summary>
                <RecipeView recipe={g.recipe} />
              </details>
            </div>
          ),
        )}
        <p className="text-muted-foreground text-xs">
          {t("planner.after", { level: step.level, sp: step.spLeft })}
        </p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
          {STAT_KEYS.map((k) => {
            const need = step.requirements?.[k] ?? 0;
            return (
              <span key={k} className={need > step.stats[k] ? "text-destructive" : ""}>
                {t(`stat.${k}` as const)} {step.stats[k]}
                {need > 0 ? ` / ${need}` : ""}
              </span>
            );
          })}
        </div>
        {step.buildsUpTo && (
          <p className="font-medium">
            {t("planner.step.buildup", { weapon: name(step.buildsUpTo) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
