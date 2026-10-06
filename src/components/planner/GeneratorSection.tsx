import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import {
  STAT_KEYS,
  abilityId,
  type AbilityId,
  type Stats,
  type Weapon,
  type WeaponType,
} from "@/lib/schemas";
import { startToState } from "@/lib/guide/derive";
import { $draft } from "@/lib/guide/draft";
import { planResultToGuide, stateToBuildStart } from "@/lib/guide/fromPlan";
import { cancelPlanner, loadTemplates, runPlanner } from "@/lib/planner/client";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "@/lib/planner/graph";
import { earliestChapter, type PlanProgress, type PlanResult } from "@/lib/planner/plan";
import type { Objective } from "@/lib/planner/solve";
import { getWeapon, weaponById, weaponData } from "@/lib/planner/sources";
import { OPPOSITES, freshState, type WeaponState } from "@/lib/weapons/mechanics";
import { $profile, saveGuide, setPlannerInputs, setView } from "@/lib/store";
import { PlanPreview } from "./PlanPreview";
import { StartSpecs } from "./StartSpecs";
import { selectClass, WeaponSelect } from "./WeaponSelect";
import { TargetSpecs } from "./TargetSpecs";
import { WeaponTypeTabs } from "./WeaponTypeTabs";

function defaultStart(targetId: string): string {
  const anc = [...ancestorsOf(targetId)];
  return anc.find((id) => rootWeaponIds.has(id)) ?? targetId;
}

/**
 * The default target of a type: the alphabetically first final weapon (e.g. Grade Zero), or — for
 * types without one (clubs) — the alphabetically first weapon of the highest SP tier.
 */
function defaultTargetOf(type: WeaponType): string {
  const first = (ws: Weapon[]) => [...ws].sort((a, b) => a.name.localeCompare(b.name))[0]?.id;
  const finals = weaponData.weapons.filter((w) => w.type === type && finalWeaponIds.includes(w.id));
  if (finals.length) return first(finals)!;
  const ws = weaponData.weapons.filter((w) => w.type === type);
  const top = Math.max(...ws.map((w) => w.spPerLevel));
  return first(ws.filter((w) => w.spPerLevel === top))!;
}

const isZero = (s: Stats) => STAT_KEYS.every((k) => s[k] === 0);

/** Ability checkboxes with the usual preset; opposites exclude each other. */
function AbilityPicker({
  abilities,
  onChange,
}: {
  abilities: AbilityId[];
  onChange: (a: AbilityId[]) => void;
}) {
  const t = useTranslations();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted-foreground mb-1 text-xs">{t("planner.wantAbilities")}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {abilityId.options.map((a) => {
          const opposite = OPPOSITES[a];
          const blocked = !!opposite && abilities.includes(opposite);
          return (
            <Label
              key={a}
              className={`flex items-center gap-2 text-sm ${blocked ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                disabled={blocked}
                checked={abilities.includes(a)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...abilities, a] : abilities.filter((x) => x !== a))
                }
              />
              {t(`ability.${a}` as const)}
            </Label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange(["poison", "stop", "abs-up", "steal", "wealth", "dark", "durable", "absorb"])
          }
        >
          {t("planner.abilitiesPreset")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          {t("planner.abilitiesClear")}
        </Button>
        <span className="text-muted-foreground text-xs">{t("planner.abilitiesHint")}</span>
      </div>
    </fieldset>
  );
}

/**
 * Generates an optimal weapon build: pick a weapon type (left tabs), a target weapon with required
 * specs, optional abilities, a start point and the limits; the result can be opened in the editor or
 * saved as a guide.
 */
export function GeneratorSection({ onOpenEditor }: { onOpenEditor: () => void }) {
  const t = useTranslations();
  const { view } = useStore($profile);
  // The same setting as the dashboard toggle: plans only use buyable items unless it is switched off.
  const allowFound = !view.buyableOnly;
  // The last inputs are remembered per profile; ignore ones that point at weapons that no longer exist.
  const remembered = $profile.get().planner;
  const saved0 =
    remembered && weaponById.has(remembered.targetId) && weaponById.has(remembered.start.weaponId)
      ? remembered
      : undefined;
  const initialTarget = saved0?.targetId ?? defaultTargetOf("wrench");
  const [typeTab, setTypeTab] = useState<WeaponType>(() => getWeapon(initialTarget).type);
  const [targetId, setTargetId] = useState(initialTarget);
  // Target specs default to the weapon's max stats (all-zero inputs come from older remembered data).
  const [endStats, setEndStats] = useState<Stats>(() =>
    saved0 && !isZero(saved0.endStats) ? saved0.endStats : { ...getWeapon(initialTarget).maxStats },
  );
  const [endLevel, setEndLevel] = useState(saved0?.endLevel ?? 0);
  const [abilities, setAbilities] = useState<AbilityId[]>(saved0?.abilities ?? []);
  const [customStart, setCustomStart] = useState(saved0?.customStart ?? false);
  const [start, setStart] = useState<WeaponState>(() =>
    saved0?.customStart
      ? startToState(saved0.start)
      : freshState(getWeapon(defaultStart(initialTarget))),
  );
  const [support, setSupport] = useState(saved0 ? saved0.start.spBonus === 1 : true);
  const [objective, setObjective] = useState<Objective>(saved0?.objective ?? "abs");
  const [maxChapter, setMaxChapter] = useState(
    () => saved0?.maxChapter ?? earliestChapter(defaultStart(initialTarget), initialTarget),
  );
  const [budget, setBudget] = useState(saved0?.budget ?? "");
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [used, setUsed] = useState<{
    start: WeaponState;
    spBonus: number;
    goalLabel: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Remember the inputs whenever they change.
  useEffect(() => {
    const { acquire: _a, ...startPart } = stateToBuildStart(start, support ? 1 : 0);
    setPlannerInputs({
      targetId,
      objective,
      maxChapter,
      budget,
      abilities,
      customStart,
      endStats,
      endLevel,
      start: startPart,
    });
  }, [
    targetId,
    objective,
    maxChapter,
    budget,
    abilities,
    customStart,
    endStats,
    endLevel,
    start,
    support,
  ]);

  // Elapsed time while planning, so a long solve doesn't look stuck.
  useEffect(() => {
    if (!running) return;
    const began = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 500);
    return () => clearInterval(timer);
  }, [running]);

  // The target dropdown puts the final weapons of the line in their own tier at the top, then groups
  // the rest by SP tier (the game's low/mid/high weapon tiers), highest first, so endgame weapons
  // sit above starter weapons like the Battle Wrench.
  const typeWeapons = useMemo(() => {
    const ofType = weaponData.weapons.filter((x) => x.type === typeTab);
    const name = (a: Weapon, b: Weapon) => a.name.localeCompare(b.name);
    const finals = ofType.filter((w) => finalWeaponIds.includes(w.id)).sort(name);
    const byTier = new Map<number, Weapon[]>();
    for (const w of ofType.filter((x) => !finals.includes(x)))
      byTier.set(w.spPerLevel, [...(byTier.get(w.spPerLevel) ?? []), w]);
    return [
      ...(finals.length ? [{ sp: "final" as const, weapons: finals }] : []),
      ...[...byTier.entries()]
        .sort(([a], [b]) => b - a)
        .map(([sp, weapons]) => ({ sp, weapons: [...weapons].sort(name) })),
    ];
  }, [typeTab]);
  const startOptions = useMemo(() => ancestorsOf(targetId), [targetId]);
  const target = getWeapon(targetId);

  /** Selecting a target prefills its max specs and, unless a custom start is set, the line's first weapon. */
  const selectTarget = (id: string) => {
    setTargetId(id);
    setEndStats({ ...getWeapon(id).maxStats });
    setEndLevel(0);
    const from = defaultStart(id);
    if (!ancestorsOf(id).has(start.weaponId)) setStart(freshState(getWeapon(from)));
    setMaxChapter(earliestChapter(from, id));
    setResult(null);
  };

  const changeType = (type: WeaponType) => {
    setTypeTab(type);
    if (target.type === type) return;
    // Switching a tab defaults to the type's highest-tier weapon.
    selectTarget(defaultTargetOf(type));
  };

  const chooseStartPoint = (mode: "optimal" | "custom") => {
    setCustomStart(mode === "custom");
    setResult(null);
    if (mode === "optimal") setStart(freshState(getWeapon(defaultStart(targetId))));
  };

  // Deep link from weapon pages: /planner?target=<weapon id>
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("target");
    if (id && weaponData.weapons.some((w) => w.id === id)) {
      setTypeTab(getWeapon(id).type);
      selectTarget(id);
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm the sphere-template cache for the current option set while the user fills in the form,
  // so the first "generate plan" doesn't pay for it (it all runs in the planner worker).
  useEffect(() => {
    loadTemplates({ maxChapter, spBonus: support ? 1 : 0, allowFound }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxChapter, support, allowFound]);

  const goalLabel = STAT_KEYS.every((k) => endStats[k] >= target.maxStats[k])
    ? t("planner.goal.max")
    : isZero(endStats)
      ? t("planner.goal.reach")
      : t("planner.customGoal");

  const generate = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setProgress(null);
    try {
      const r = await runPlanner(
        {
          start,
          // "Optimal" searches every acquirable weapon in the target's build-up line for the
          // cheapest start; a custom start is used exactly as given.
          optimalStart: !customStart,
          targetId,
          objective,
          goal: { kind: "stats", stats: endStats, level: endLevel },
          maxChapter,
          spBonus: support ? 1 : 0,
          allowFound,
          maxGilda: budget.trim() ? Math.max(0, Number(budget)) : undefined,
          abilities,
        },
        setProgress,
      );
      setResult(r);
      // The optimal search may start from a different weapon than the form's default.
      const startUsed =
        !customStart && r.plan?.stages[0]
          ? freshState(getWeapon(r.plan.stages[0].weaponId))
          : start;
      setUsed({ start: startUsed, spBonus: support ? 1 : 0, goalLabel });
    } catch (e) {
      if (String(e).includes("cancelled")) return;
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setRunning(false);
    }
  };

  /** The generated build as a guide. */
  const draft = useMemo(() => {
    if (result?.status !== "ok" || !used) return null;
    const title = `${target.name} — ${t(`planner.obj.${objective}` as const)}`;
    return planResultToGuide({
      title,
      description: `${t(`planner.obj.${objective}` as const)} · ${used.goalLabel} · ${t("planner.chapterOption", { n: maxChapter })}`,
      result,
      start: used.start,
      spBonus: used.spBonus,
      ...(result.acquire ? { acquire: result.acquire } : {}),
    });
    // The description should describe the request that produced the result, not later form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("planner.intro")}</p>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <WeaponTypeTabs value={typeTab} onChange={changeType} />
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <section
            className="flex flex-col gap-3 rounded-md border p-3"
            aria-label={t("planner.target")}
          >
            <h3 className="font-medium">{t("planner.target")}</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Label className="flex flex-1 flex-col items-start gap-1">
                {t("planner.pickTarget")}
                <select
                  className={selectClass}
                  value={targetId}
                  onChange={(e) => selectTarget(e.target.value)}
                >
                  {typeWeapons.map((g) => (
                    <optgroup
                      key={g.sp}
                      label={
                        g.sp === "final" ? t("planner.finalTier") : t("planner.spTier", { n: g.sp })
                      }
                    >
                      {g.weapons.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Label>
              <div
                aria-label={t("planner.minMaxSpecs")}
                className="text-muted-foreground flex max-w-xs flex-wrap gap-x-3 gap-y-1 text-xs"
              >
                {STAT_KEYS.map((k) => (
                  <span key={k} className="whitespace-nowrap">
                    {t(`stat.${k}` as const)} {target.baseStats[k]}–{target.maxStats[k]}
                  </span>
                ))}
              </div>
            </div>
            <TargetSpecs
              weaponId={targetId}
              stats={endStats}
              level={endLevel}
              onStats={setEndStats}
              onLevel={setEndLevel}
            />
            <AbilityPicker abilities={abilities} onChange={setAbilities} />
          </section>

          <section
            className="flex flex-col gap-3 rounded-md border p-3"
            aria-label={t("planner.startSection")}
          >
            <h3 className="font-medium">{t("planner.startSection")}</h3>
            <Label className="flex w-full flex-col items-start gap-1 sm:w-72">
              {t("planner.startPoint")}
              <select
                className={selectClass}
                value={customStart ? "custom" : "optimal"}
                onChange={(e) => chooseStartPoint(e.target.value as "optimal" | "custom")}
              >
                <option value="optimal">{t("planner.startPoint.optimal")}</option>
                <option value="custom">{t("planner.startPoint.custom")}</option>
              </select>
            </Label>
            {customStart ? (
              <div className="flex flex-col gap-3">
                <Label className="flex w-full flex-col items-start gap-1 sm:w-72">
                  {t("planner.pickStart")}
                  <WeaponSelect
                    value={start.weaponId}
                    ids={startOptions}
                    tierOrder
                    onChange={(id) => setStart(freshState(getWeapon(id)))}
                  />
                </Label>
                <StartSpecs state={start} onChange={setStart} />
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">{t("planner.startPoint.optimalHint")}</p>
            )}
            <Label className="flex items-center gap-2 text-sm">
              <Switch checked={support} onCheckedChange={setSupport} />
              {t("planner.support")}
            </Label>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="flex flex-col items-start gap-1">
              {t("planner.objective")}
              <select
                className={selectClass}
                value={objective}
                onChange={(e) => setObjective(e.target.value as Objective)}
              >
                {(["abs", "gilda", "steps"] as const).map((o) => (
                  <option key={o} value={o}>
                    {t(`planner.obj.${o}` as const)}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t("planner.chapter")}
              <select
                className={selectClass}
                value={maxChapter}
                onChange={(e) => setMaxChapter(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {t("planner.chapterOption", { n })}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t("planner.budget")}
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={t("planner.budgetPlaceholder")}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </Label>
            <div className="flex flex-col justify-end gap-3">
              <Label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={view.buyableOnly}
                  onCheckedChange={(v) => setView({ buyableOnly: v })}
                />
                {t("planner.found")}
              </Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={generate} disabled={running}>
              {running ? t("planner.running") : t("planner.generate")}
            </Button>
            {running && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelPlanner();
                  setRunning(false);
                }}
              >
                {t("planner.cancel")}
              </Button>
            )}
          </div>

          {running && (
            <div className="flex flex-col gap-1" role="status" aria-live="polite">
              <p className="text-sm">
                {t(`planner.progress.${progress?.phase ?? "templates"}` as const, {
                  done: (progress?.done ?? 0) + 1,
                  total: progress?.total ?? 1,
                })}{" "}
                <span className="text-muted-foreground tabular-nums">
                  · {t("planner.elapsed", { s: elapsed })}
                </span>
              </p>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all"
                  style={{
                    width: `${progress ? Math.round(((["templates", "rank", "solve", "finish"].indexOf(progress.phase) + progress.done / Math.max(1, progress.total)) / 4) * 100) : 5}%`,
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm">{t("planner.error", { message: error })}</p>
          )}
          {result?.status === "no-path" && <p className="text-sm">{t("planner.noPath")}</p>}
          {result?.status === "infeasible" && <p className="text-sm">{t("planner.infeasible")}</p>}
        </div>
      </div>

      {draft && (
        <>
          {result?.abilitiesMissing && (
            <p className="text-sm">
              {t("planner.abilitiesMissing", {
                list: result.abilitiesMissing.map((a) => t(`ability.${a}` as const)).join(", "),
              })}
            </p>
          )}
          <PlanPreview guide={draft} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                $draft.set({ guide: draft, persisted: false });
                onOpenEditor();
              }}
            >
              {t("planner.openInEditor")}
            </Button>
            <Button
              variant="outline"
              disabled={saved}
              onClick={() => {
                saveGuide(draft, { activate: true });
                setSaved(true);
              }}
            >
              {t("planner.saveAsGuide")}
            </Button>
            {saved && (
              <span className="text-sm" role="status">
                {t("planner.saved")}{" "}
                <a className="underline" href="/guides">
                  {t("nav.guides")}
                </a>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
