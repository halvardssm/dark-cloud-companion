import { STAT_KEYS } from "@/lib/schemas";
import { useTranslations, type Translate } from "@/i18n";
import type { DerivedStep } from "@/lib/guide/derive";
import type { Step } from "@/lib/guide/types";
import { getWeapon, itemAvailability } from "@/lib/planner/sources";
import { Badge } from "@/components/ui/badge";
import type { Acquire, Recipe, Stage } from "@/lib/planner/types";

const name = (id: string) => getWeapon(id).name;

export function acquireText(t: Translate, a: Acquire) {
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

/** One weapon-build stage: what to do and what the weapon looks like afterwards (derived by the simulator). */
export function BuildStepBody({
  step,
  derived,
  buyableOnly = false,
}: {
  step: Step;
  derived?: DerivedStep;
  /** When set, a warning is shown if the step uses items that can't be bought. */
  buyableOnly?: boolean;
}) {
  const t = useTranslations();
  const stage = step.build;
  if (!stage) return null;
  const groups = groupSynths(stage);
  const foundItems = [
    ...new Set(
      groups.flatMap((g) =>
        g.kind === "item" && itemAvailability(g.name).kind === "found" ? [g.name] : [],
      ),
    ),
  ];
  const last = (r: Recipe) => r.stages[r.stages.length - 1];
  return (
    <div className="flex flex-col gap-2 text-sm">
      {stage.levelTo > 0 && (
        <p>{t("planner.step.levelOnly", { weapon: name(stage.weaponId), to: stage.levelTo })}</p>
      )}
      {groups.map((g, i) =>
        g.kind === "item" ? (
          <p key={i} className="flex flex-wrap items-center gap-2">
            {t("planner.step.itemFree", { count: g.count, name: g.name })}
            {itemAvailability(g.name).kind === "found" && (
              <Badge variant="outline">{t("items.foundOnly")}</Badge>
            )}
          </p>
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
      {buyableOnly && foundItems.length > 0 && (
        <p className="text-destructive text-xs">
          {t("step.foundItems", { items: foundItems.join(", ") })}
        </p>
      )}
      {derived && (
        <>
          <p className="text-muted-foreground text-xs">
            {t("planner.step.cost", {
              abs: Math.round(derived.cost.abs).toLocaleString(),
              gilda: Math.round(derived.cost.gilda).toLocaleString(),
            })}{" "}
            · {t("planner.after", { level: derived.level, sp: derived.sp })}
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
            {STAT_KEYS.map((k) => {
              const need = derived.requirements?.[k] ?? 0;
              return (
                <span key={k} className={need > derived.stats[k] ? "text-destructive" : ""}>
                  {t(`stat.${k}` as const)} {derived.stats[k]}
                  {need > 0 ? ` / ${need}` : ""}
                </span>
              );
            })}
          </div>
          {derived.nextWeaponId && (
            <p className="font-medium">
              {t("planner.step.buildup", { weapon: name(derived.nextWeaponId) })}
            </p>
          )}
          {derived.errors.length > 0 && (
            <div className="text-destructive text-xs">
              <p className="font-medium">{t("step.problems")}</p>
              <ul className="list-disc pl-5">
                {derived.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
