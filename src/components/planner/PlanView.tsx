import { STAT_KEYS } from "@/data/weapons-schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations, type Translate } from "@/i18n";
import type { PlanResult } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import type { Acquire, Recipe, Stage } from "@/lib/planner/types";
import { buildUpRequirements } from "@/lib/weapons/mechanics";

const name = (id: string) => getWeapon(id).name;

function acquireText(t: Translate, a: Acquire) {
  if (a.kind === "shop") return t("planner.acquire.shop", { shop: a.shop, price: a.price });
  if (a.kind === "invent") return t("planner.acquire.invent", { gilda: a.gilda });
  return t("planner.acquire.have");
}

/** Groups identical consecutive sphere recipes so "3 × Heavy Hammer +5" reads as one line. */
function groupSynths(stage: Stage) {
  const groups: (
    | { kind: "item"; name: string; count: number }
    | { kind: "sphere"; recipe: Recipe; count: number }
  )[] = [];
  for (const s of stage.synths) {
    if (s.kind === "item") {
      groups.push({ kind: "item", name: s.name, count: s.count });
      continue;
    }
    const key = JSON.stringify(s.recipe);
    const last = groups.find((g) => g.kind === "sphere" && JSON.stringify(g.recipe) === key);
    if (last) last.count++;
    else groups.push({ kind: "sphere", recipe: s.recipe, count: 1 });
  }
  return groups;
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const t = useTranslations();
  const first = recipe.stages[0].weaponId;
  return (
    <ol className="text-muted-foreground mt-1 flex list-decimal flex-col gap-1 pl-5 text-xs">
      <li>
        {t("planner.step.acquire", { weapon: name(first) })}: {acquireText(t, recipe.acquire)}
      </li>
      {recipe.stages.map((s, i) => (
        <li key={i}>
          {name(s.weaponId)}: +{s.levelTo}
          {s.synths.length > 0 &&
            ` · ${s.synths.map((x) => (x.kind === "item" ? `${x.count}× ${x.name}` : "sphere")).join(", ")}`}
          {i < recipe.stages.length - 1 &&
            ` → ${t("planner.step.buildup", { weapon: name(recipe.stages[i + 1].weaponId) })}`}
        </li>
      ))}
    </ol>
  );
}

export function PlanView({ result }: { result: PlanResult }) {
  const t = useTranslations();
  if (!result.plan || !result.simulation || !result.chain) return null;
  const { plan, simulation, chain } = result;
  const snapshots = simulation.log.filter((l) => l.type === "state" && l.depth === 0);
  const levels = simulation.log.filter((l) => l.type === "level" && l.depth === 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("planner.total")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge>{t("planner.totalAbs", { n: simulation.cost.abs.toLocaleString() })}</Badge>
          <Badge variant="secondary">
            {t("planner.totalGilda", { n: simulation.cost.gilda.toLocaleString() })}
          </Badge>
          <Badge variant="outline">{t("planner.totalSteps", { n: simulation.cost.steps })}</Badge>
        </CardContent>
      </Card>

      <p className="text-sm">
        <span className="text-muted-foreground">{t("planner.route")}: </span>
        {chain.map(name).join(" → ")}
      </p>

      <ol className="flex flex-col gap-3">
        {plan.stages.map((stage, i) => {
          const snap = snapshots[i];
          const levelStep = levels.find((l) => l.type === "level" && l.weaponId === stage.weaponId);
          const next = plan.stages[i + 1];
          const req = next ? buildUpRequirements(getWeapon(next.weaponId)) : undefined;
          const groups = groupSynths(stage);
          return (
            <li key={i}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>
                    {i + 1}. {name(stage.weaponId)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {levelStep && levelStep.type === "level" && (
                    <p>
                      {t("planner.step.level", {
                        weapon: name(stage.weaponId),
                        from: levelStep.from,
                        to: levelStep.to,
                        abs: levelStep.abs.toLocaleString(),
                      })}
                    </p>
                  )}
                  {groups.map((g, gi) =>
                    g.kind === "item" ? (
                      <p key={gi}>{t("planner.step.itemFree", { count: g.count, name: g.name })}</p>
                    ) : (
                      <div key={gi}>
                        <p>
                          {g.count > 1
                            ? t("planner.step.sphereCount", {
                                count: g.count,
                                weapon: name(g.recipe.stages.at(-1)!.weaponId),
                                level: g.recipe.stages.at(-1)!.levelTo,
                                sp: g.recipe.stages.at(-1)!.levelTo,
                              })
                            : t("planner.step.sphere", {
                                weapon: name(g.recipe.stages.at(-1)!.weaponId),
                                level: g.recipe.stages.at(-1)!.levelTo,
                                sp: g.recipe.stages.at(-1)!.levelTo,
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
                  {snap && snap.type === "state" && (
                    <>
                      <p className="text-muted-foreground text-xs">
                        {t("planner.after", { level: snap.level, sp: snap.sp })}
                      </p>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
                        {STAT_KEYS.map((k) => (
                          <span
                            key={k}
                            className={req && snap.stats[k] < req[k] ? "text-destructive" : ""}
                          >
                            {t(`stat.${k}` as const)} {snap.stats[k]}
                            {req && req[k] > 0 ? ` / ${req[k]}` : ""}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {next && (
                    <p className="font-medium">
                      {t("planner.step.buildup", { weapon: name(next.weaponId) })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      {result.alternatives.length > 1 && (
        <details>
          <summary className="cursor-pointer text-sm">{t("planner.alternatives")}</summary>
          <ul className="text-muted-foreground mt-2 flex flex-col gap-1 text-xs">
            {result.alternatives.map((o, i) => (
              <li key={i}>
                {o.chain.map(name).join(" → ")}
                {o.cost
                  ? ` — ${o.cost.abs.toLocaleString()} ABS, ${o.cost.gilda.toLocaleString()} gilda`
                  : ` — ${o.status}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
