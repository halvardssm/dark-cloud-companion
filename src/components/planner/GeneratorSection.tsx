import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { allGuides } from "@/lib/guide/builtin";
import { startToState } from "@/lib/guide/derive";
import { stateToBuildStart } from "@/lib/guide/fromPlan";
import { $draft } from "@/lib/guide/draft";
import { deriveBuild } from "@/lib/guide/derive";
import { appendPlanToGuide, planResultToGuide } from "@/lib/guide/fromPlan";
import { derivedFor } from "@/lib/guide/useDerived";
import { cancelPlanner, runPlanner } from "@/lib/planner/client";
import { ancestorsOf, rootWeaponIds } from "@/lib/planner/graph";
import { earliestChapter, type PlanProgress, type PlanResult } from "@/lib/planner/plan";
import type { Objective } from "@/lib/planner/solve";
import { getWeapon, weaponById, weaponData } from "@/lib/planner/sources";
import { OPPOSITES, emptyStats, freshState, type WeaponState } from "@/lib/weapons/mechanics";
import { abilityId, type AbilityId, type Stats } from "@/data/weapons-schema";
import { $profile, saveGuide, setPlannerInputs, setView } from "@/lib/store";
import { useStore } from "@nanostores/react";
import { PlanPreview } from "./PlanPreview";
import { StartSpecs } from "./StartSpecs";
import { selectClass } from "./WeaponSelect";
import { TargetSpecs } from "./TargetSpecs";
import { WeaponPicker } from "./WeaponPicker";

function defaultStart(targetId: string): string {
  const anc = [...ancestorsOf(targetId)];
  return anc.find((id) => rootWeaponIds.has(id)) ?? targetId;
}

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

type StartMode = "fresh" | "custom" | "guide";
type EndMode = "existing" | "custom";

const segment = (active: boolean) =>
  `rounded-md border px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`;

/** Generates an optimal weapon build; the result can be opened in the editor or saved as a guide. */
export function GeneratorSection({ onOpenEditor }: { onOpenEditor: () => void }) {
  const t = useTranslations();
  const { guides: own, view } = useStore($profile);
  // The same setting as the dashboard toggle: plans only use buyable items unless it is switched off.
  const allowFound = !view.buyableOnly;
  // The last inputs are remembered per profile; ignore ones that point at weapons that no longer exist.
  const remembered = $profile.get().planner;
  const saved0 =
    remembered && weaponById.has(remembered.targetId) && weaponById.has(remembered.start.weaponId)
      ? remembered
      : undefined;
  const [targetId, setTargetId] = useState(saved0?.targetId ?? "grade-zero");
  const [start, setStart] = useState<WeaponState>(() =>
    saved0 ? startToState(saved0.start) : freshState(getWeapon(defaultStart("grade-zero"))),
  );
  const [startMode, setStartMode] = useState<StartMode>(saved0?.startMode ?? "fresh");
  const [endMode, setEndMode] = useState<EndMode>(saved0?.endMode ?? "existing");
  const [endStats, setEndStats] = useState<Stats>(saved0?.endStats ?? emptyStats());
  const [endLevel, setEndLevel] = useState(saved0?.endLevel ?? 0);
  const [baseGuideId, setBaseGuideId] = useState(saved0?.baseGuideId ?? "");
  const [objective, setObjective] = useState<Objective>(saved0?.objective ?? "abs");
  const [goal, setGoal] = useState<"reach" | "max">(saved0?.goal ?? "reach");
  const [maxChapter, setMaxChapter] = useState(
    () => saved0?.maxChapter ?? earliestChapter(defaultStart("grade-zero"), "grade-zero"),
  );
  const [budget, setBudget] = useState(saved0?.budget ?? "");
  const [support, setSupport] = useState(saved0 ? saved0.start.spBonus === 1 : true);
  const [abilities, setAbilities] = useState<AbilityId[]>(saved0?.abilities ?? []);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [used, setUsed] = useState<{
    start: WeaponState;
    spBonus: number;
    baseId: string;
    goalLabel: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Guides that contain a weapon build can serve as the starting point.
  const baseOptions = useMemo(
    () => allGuides(own).filter((g) => g.steps.some((s) => s.build)),
    [own],
  );
  const baseGuide =
    startMode === "guide" ? baseOptions.find((g) => g.id === baseGuideId) : undefined;

  // Remember the inputs whenever they change.
  useEffect(() => {
    const { acquire: _a, ...startPart } = stateToBuildStart(start, support ? 1 : 0);
    setPlannerInputs({
      targetId,
      baseGuideId,
      objective,
      goal,
      maxChapter,
      budget,
      abilities,
      startMode,
      endMode,
      endStats,
      endLevel,
      start: startPart,
    });
  }, [
    targetId,
    baseGuideId,
    objective,
    goal,
    maxChapter,
    budget,
    abilities,
    start,
    support,
    startMode,
    endMode,
    endStats,
    endLevel,
  ]);

  // Elapsed time while planning, so a long solve doesn't look stuck.
  useEffect(() => {
    if (!running) return;
    const began = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 500);
    return () => clearInterval(timer);
  }, [running]);

  const startOptions = useMemo(() => ancestorsOf(targetId), [targetId]);

  const changeTarget = (id: string) => {
    setTargetId(id);
    setEndStats(emptyStats());
    if (!baseGuide) {
      const from = ancestorsOf(id).has(start.weaponId) ? start.weaponId : defaultStart(id);
      if (from !== start.weaponId) setStart(freshState(getWeapon(from)));
      setMaxChapter(earliestChapter(from, id));
    }
    setResult(null);
  };

  // Deep link from weapon pages: /planner?target=<weapon id>
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("target");
    if (id && weaponData.weapons.some((w) => w.id === id)) changeTarget(id);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseStartMode = (mode: StartMode) => {
    setStartMode(mode);
    setResult(null);
    if (mode === "guide") {
      const first = baseGuideId || baseOptions[0]?.id || "";
      if (first) chooseBase(first);
      return;
    }
    setBaseGuideId("");
    // Back to a weapon of the chosen line.
    if (!startOptions.has(start.weaponId)) setStart(freshState(getWeapon(defaultStart(targetId))));
  };

  const chooseBase = (id: string) => {
    setBaseGuideId(id);
    setResult(null);
    const g = baseOptions.find((x) => x.id === id);
    if (!g) return;
    // Continue from the weapon the guide leaves you with.
    const final = derivedFor(g).final;
    if (final) {
      setStart(final);
      setSupport(g.build?.spBonus === 1);
      if (!ancestorsOf(targetId).has(final.weaponId)) {
        // Pick the first weapon the base weapon can build up into as a sensible target.
        const next = getWeapon(final.weaponId).buildsUpTo[0];
        if (next) setTargetId(next);
      }
    }
  };

  const goalLabel =
    endMode === "custom" ? t("planner.customGoal") : t(`planner.goal.${goal}` as const);

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
          targetId,
          objective,
          goal:
            endMode === "custom"
              ? { kind: "stats", stats: endStats, level: endLevel }
              : { kind: goal },
          maxChapter,
          spBonus: support ? 1 : 0,
          allowFound,
          maxGilda: budget.trim() ? Math.max(0, Number(budget)) : undefined,
          abilities,
        },
        setProgress,
      );
      setResult(r);
      setUsed({ start, spBonus: support ? 1 : 0, baseId: baseGuide?.id ?? "", goalLabel });
    } catch (e) {
      if (String(e).includes("cancelled")) return;
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setRunning(false);
    }
  };

  /** The generated build as a guide: standalone, or appended to the chosen base guide. */
  const draft = useMemo(() => {
    if (result?.status !== "ok" || !used) return null;
    const title = `${getWeapon(targetId).name} — ${t(`planner.obj.${objective}` as const)}`;
    const generated = planResultToGuide({
      title,
      description: `${t(`planner.obj.${objective}` as const)} · ${used.goalLabel} · ${t("planner.chapterOption", { n: maxChapter })}`,
      result,
      start: used.start,
      spBonus: used.spBonus,
    });
    const base = baseOptions.find((g) => g.id === used.baseId);
    if (!base) return generated;
    try {
      const combined = appendPlanToGuide(
        base,
        generated,
        `${base.title} + ${getWeapon(targetId).name}`,
      );
      return deriveBuild(combined).errors.length ? generated : combined;
    } catch {
      return generated;
    }
    // The description should describe the request that produced the result, not later form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("planner.intro")}</p>

      <section
        className="flex flex-col gap-3 rounded-md border p-3"
        aria-label={t("planner.startSection")}
      >
        <h3 className="font-medium">{t("planner.startSection")}</h3>
        <div
          role="radiogroup"
          aria-label={t("planner.startSection")}
          className="flex flex-wrap gap-2"
        >
          {(["fresh", "custom", "guide"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={startMode === m}
              disabled={m === "guide" && baseOptions.length === 0}
              onClick={() => chooseStartMode(m)}
              className={segment(startMode === m)}
            >
              {t(`planner.startMode.${m}` as const)}
            </button>
          ))}
        </div>
        {startMode === "guide" ? (
          <Label className="flex flex-col items-start gap-1">
            {t("planner.startFromGuide")}
            <select
              className={selectClass}
              value={baseGuideId}
              onChange={(e) => chooseBase(e.target.value)}
            >
              {baseOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-xs">
              {t("planner.startFromGuideHint")} — {getWeapon(start.weaponId).name} +{start.level}
            </span>
          </Label>
        ) : (
          <WeaponPicker
            label={t("planner.pickStart")}
            value={start.weaponId}
            ids={startOptions}
            onChange={(id) => setStart(freshState(getWeapon(id)))}
          />
        )}
        {startMode === "custom" && <StartSpecs state={start} onChange={setStart} />}
        <Label className="flex items-center gap-2 text-sm">
          <Switch checked={support} onCheckedChange={setSupport} />
          {t("planner.support")}
        </Label>
      </section>

      <section
        className="flex flex-col gap-3 rounded-md border p-3"
        aria-label={t("planner.endSection")}
      >
        <h3 className="font-medium">{t("planner.endSection")}</h3>
        <div
          role="radiogroup"
          aria-label={t("planner.endSection")}
          className="flex flex-wrap gap-2"
        >
          {(["existing", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={endMode === m}
              onClick={() => {
                setEndMode(m);
                setResult(null);
              }}
              className={segment(endMode === m)}
            >
              {t(`planner.endMode.${m}` as const)}
            </button>
          ))}
        </div>
        <WeaponPicker label={t("planner.pickTarget")} value={targetId} onChange={changeTarget} />
        {endMode === "existing" ? (
          <div className="flex flex-col gap-3">
            <Label className="flex w-fit flex-col items-start gap-1">
              {t("planner.goal")}
              <select
                className={selectClass}
                value={goal}
                onChange={(e) => setGoal(e.target.value as "reach" | "max")}
              >
                <option value="reach">{t("planner.goal.reach")}</option>
                <option value="max">{t("planner.goal.max")}</option>
              </select>
            </Label>
            <AbilityPicker abilities={abilities} onChange={setAbilities} />
          </div>
        ) : (
          <TargetSpecs
            weaponId={targetId}
            stats={endStats}
            level={endLevel}
            abilities={abilities}
            onStats={setEndStats}
            onLevel={setEndLevel}
            onAbilities={setAbilities}
          />
        )}
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
