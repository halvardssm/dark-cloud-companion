import { useMemo, useState } from "react";
import { weaponType } from "@/data/weapons-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { cancelPlanner, runPlanner } from "@/lib/planner/client";
import { ancestorsOf, rootWeaponIds } from "@/lib/planner/graph";
import { earliestChapter, type PlanResult } from "@/lib/planner/plan";
import type { Objective } from "@/lib/planner/solve";
import { getWeapon, weaponData } from "@/lib/planner/sources";
import { freshState, type WeaponState } from "@/lib/weapons/mechanics";
import { GuideView } from "@/components/guides/GuideView";
import { planToGuide } from "@/lib/guides/fromPlan";
import { addCustomGuide } from "@/lib/store";
import { StartSpecs } from "./StartSpecs";

const selectClass = "bg-background h-10 w-full rounded-md border px-3 text-sm";

function WeaponSelect({
  value,
  onChange,
  ids,
}: {
  value: string;
  onChange: (id: string) => void;
  ids?: Set<string>;
}) {
  const t = useTranslations();
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {weaponType.options.map((type) => {
        const ws = weaponData.weapons.filter((w) => w.type === type && (!ids || ids.has(w.id)));
        if (!ws.length) return null;
        return (
          <optgroup key={type} label={t(`weapon.type.${type}` as const)}>
            {ws.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

function defaultStart(targetId: string): string {
  const anc = [...ancestorsOf(targetId)];
  return anc.find((id) => rootWeaponIds.has(id)) ?? targetId;
}

export function PlannerApp() {
  const t = useTranslations();
  const [targetId, setTargetId] = useState("grade-zero");
  const [start, setStart] = useState<WeaponState>(() =>
    freshState(getWeapon(defaultStart("grade-zero"))),
  );
  const [objective, setObjective] = useState<Objective>("abs");
  const [goal, setGoal] = useState<"reach" | "max">("reach");
  const [maxChapter, setMaxChapter] = useState(() =>
    earliestChapter(defaultStart("grade-zero"), "grade-zero"),
  );
  const [budget, setBudget] = useState("");
  const [support, setSupport] = useState(true);
  const [allowFound, setAllowFound] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideName, setGuideName] = useState("");
  const [pinned, setPinned] = useState(false);

  const startOptions = useMemo(() => ancestorsOf(targetId), [targetId]);
  const draft = useMemo(
    () =>
      result?.status === "ok"
        ? planToGuide({
            id: "draft",
            title: `${getWeapon(targetId).name} — ${t(`planner.obj.${objective}` as const).toLowerCase()}`,
            kind: "custom",
            summary: `${t(`planner.obj.${objective}` as const)} · ${t(`planner.goal.${goal}` as const)} · ${getWeapon(start.weaponId).name} · ${t("planner.chapterOption", { n: maxChapter })}`,
            result,
          })
        : null,
    // The summary should describe the request that produced the result, not later form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
  );

  const changeTarget = (id: string) => {
    setTargetId(id);
    const from = ancestorsOf(id).has(start.weaponId) ? start.weaponId : defaultStart(id);
    if (from !== start.weaponId) setStart(freshState(getWeapon(from)));
    setMaxChapter(earliestChapter(from, id));
    setResult(null);
  };

  const generate = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setPinned(false);
    try {
      setResult(
        await runPlanner({
          start,
          targetId,
          objective,
          goal: { kind: goal },
          maxChapter,
          spBonus: support ? 1 : 0,
          allowFound,
          maxGilda: budget.trim() ? Math.max(0, Number(budget)) : undefined,
        }),
      );
    } catch (e) {
      if (String(e).includes("cancelled")) return;
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("planner.intro")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="flex flex-col items-start gap-1">
          {t("planner.target")}
          <WeaponSelect value={targetId} onChange={changeTarget} />
        </Label>
        <Label className="flex flex-col items-start gap-1">
          {t("planner.start")}
          <WeaponSelect
            value={start.weaponId}
            ids={startOptions}
            onChange={(id) => setStart(freshState(getWeapon(id)))}
          />
        </Label>
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
            <Switch checked={support} onCheckedChange={setSupport} />
            {t("planner.support")}
          </Label>
          <Label className="flex items-center gap-2 text-sm">
            <Switch checked={allowFound} onCheckedChange={setAllowFound} />
            {t("planner.found")}
          </Label>
        </div>
      </div>

      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t("planner.specs")}</summary>
        <div className="mt-3">
          <StartSpecs state={start} onChange={setStart} />
        </div>
      </details>

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

      {error && (
        <p className="text-destructive text-sm">{t("planner.error", { message: error })}</p>
      )}
      {result?.status === "no-path" && <p className="text-sm">{t("planner.noPath")}</p>}
      {result?.status === "infeasible" && <p className="text-sm">{t("planner.infeasible")}</p>}
      {result?.status === "ok" && draft && (
        <>
          <GuideView guide={draft} />
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!result) return;
              addCustomGuide(
                planToGuide({
                  id: `custom-${Date.now().toString(36)}`,
                  title: guideName.trim() || draft.title,
                  kind: "custom",
                  summary: draft.summary,
                  result,
                  createdAt: Date.now(),
                }),
              );
              setPinned(true);
            }}
          >
            <Label className="flex min-w-48 flex-1 flex-col items-start gap-1">
              {t("planner.guideName")}
              <Input
                value={guideName}
                placeholder={draft.title}
                onChange={(e) => setGuideName(e.target.value)}
              />
            </Label>
            <Button type="submit" disabled={pinned}>
              {t("planner.pin")}
            </Button>
          </form>
          {pinned && (
            <p className="text-sm" role="status">
              {t("planner.pinned")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
