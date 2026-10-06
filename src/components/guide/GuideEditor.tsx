import { useEffect, useMemo, useState } from "react";
import { BuildStepBody } from "@/components/guide/BuildStepBody";
import { StartSpecs } from "@/components/planner/StartSpecs";
import { WeaponSelect, selectClass } from "@/components/planner/WeaponSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n";
import { chapters, checklist, sectionById, sectionsOf, sections } from "@/lib/data";
import { deriveBuild, startToState } from "@/lib/guide/derive";
import { emptyStep } from "@/lib/guide/ops";
import { resolveEntry } from "@/lib/guide/refs";
import { newId, type BuildStart, type Entry, type Guide, type Step } from "@/lib/guide/types";
import { getWeapon, synthSources } from "@/lib/planner/sources";
import type { Stage } from "@/lib/planner/types";
import { freshState, type WeaponState } from "@/lib/weapons/mechanics";

const itemSources = synthSources.filter((s) => Object.keys(s.gains).some((k) => k !== "du"));

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

const toState = (b: BuildStart): WeaponState => startToState(b);
const toStart = (s: WeaponState, spBonus: number, acquire?: BuildStart["acquire"]): BuildStart => ({
  weaponId: s.weaponId,
  level: s.level,
  abs: s.abs,
  stats: { ...s.stats },
  du: s.du,
  sp: s.sp,
  abilities: [...s.abilities],
  spBonus: spBonus ? 1 : 0,
  ...(acquire ? { acquire } : {}),
});

// ---------------- entries ----------------

function EntryRow({
  entry,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  entry: Entry;
  onChange: (e: Entry) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  first: boolean;
  last: boolean;
}) {
  const t = useTranslations();
  let body;
  if (entry.kind === "text") {
    body = (
      <Input
        value={entry.text}
        maxLength={500}
        aria-label={t("editor.entries")}
        onChange={(e) => onChange({ ...entry, text: e.target.value })}
      />
    );
  } else {
    const r = resolveEntry(entry);
    const label =
      r.kind === "item"
        ? `${r.item.name} · ${t(`cat.${r.item.category}` as const)}`
        : r.kind === "section"
          ? `${r.section.title} · ${t("section.moreFacts")}`
          : `${t("editor.missing")}: ${entry.ref}`;
    body = (
      <span className="flex h-9 flex-1 items-center rounded-md border px-3 text-sm">{label}</span>
    );
  }
  return (
    <div className="flex gap-1">
      {body}
      <Button
        size="sm"
        variant="outline"
        disabled={first}
        onClick={() => onMove(-1)}
        aria-label={t("editor.moveUp")}
      >
        ↑
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={last}
        onClick={() => onMove(1)}
        aria-label={t("editor.moveDown")}
      >
        ↓
      </Button>
      <Button size="sm" variant="outline" onClick={onRemove} aria-label={t("editor.remove")}>
        ×
      </Button>
    </div>
  );
}

function AddEntries({ chapterId, onAdd }: { chapterId?: string; onAdd: (e: Entry[]) => void }) {
  const t = useTranslations();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle.length < 2
        ? []
        : checklist
            .filter((i) => i.name.toLowerCase().includes(needle))
            // Items of the step's chapter first.
            .sort((a, b) => Number(b.chapterId === chapterId) - Number(a.chapterId === chapterId))
            .slice(0, 8),
    [needle, chapterId],
  );
  const lines = (s: string) =>
    s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const l = lines(text);
          if (l.length) onAdd(l.map((x) => ({ kind: "text", id: newId(), text: x.slice(0, 500) })));
          setText("");
        }}
      >
        <Input
          value={text}
          placeholder={t("editor.addText")}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (/\r?\n/.test(pasted)) {
              e.preventDefault();
              onAdd(
                lines(pasted).map((x) => ({ kind: "text", id: newId(), text: x.slice(0, 500) })),
              );
            }
          }}
        />
        <Button type="submit" variant="outline">
          {t("editor.add")}
        </Button>
      </form>
      <div className="flex flex-col gap-1">
        <Input
          type="search"
          value={q}
          placeholder={t("editor.searchCollectable")}
          aria-label={t("editor.addCollectable")}
          onChange={(e) => setQ(e.target.value)}
        />
        {matches.map((i) => (
          <Button
            key={i.id}
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              onAdd([{ kind: "item", ref: i.id }]);
              setQ("");
            }}
          >
            {i.name} · {t(`cat.${i.category}` as const)} ·{" "}
            {chapters.find((c) => c.id === i.chapterId)?.title}
          </Button>
        ))}
      </div>
      <select
        className={selectClass}
        value=""
        aria-label={t("editor.addSectionFacts")}
        onChange={(e) => e.target.value && onAdd([{ kind: "section", ref: e.target.value }])}
      >
        <option value="">
          {t("editor.addSectionFacts")} — {t("editor.chooseSection")}
        </option>
        {(chapterId ? sectionsOf(chapterId) : sections).map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------- build stage ----------------

function StageEditor({
  stage,
  allowed,
  onChange,
}: {
  stage: Stage;
  allowed: Set<string>;
  onChange: (s: Stage) => void;
}) {
  const t = useTranslations();
  const items = stage.synths.map((s, i) => ({ s, i })).filter((x) => x.s.kind === "item");
  const spheres = stage.synths.filter((s) => s.kind === "sphere").length;
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col items-start gap-1 text-xs">
          {t("editor.stageWeapon")}
          <WeaponSelect
            value={stage.weaponId}
            ids={allowed}
            className={`${selectClass} h-9`}
            onChange={(id) => onChange({ ...stage, weaponId: id })}
          />
        </Label>
        <Label className="flex flex-col items-start gap-1 text-xs">
          {t("editor.stageLevel")}
          <Input
            type="number"
            min={0}
            max={99}
            value={stage.levelTo}
            onChange={(e) =>
              onChange({
                ...stage,
                levelTo: Math.min(99, Math.max(0, Math.floor(Number(e.target.value) || 0))),
              })
            }
          />
        </Label>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t("editor.stageItems")}</span>
        {items.map(({ s, i }) =>
          s.kind === "item" ? (
            <div key={i} className="flex gap-1">
              <select
                className={`${selectClass} h-9`}
                value={s.name}
                aria-label={t("editor.itemName")}
                onChange={(e) =>
                  onChange({
                    ...stage,
                    synths: stage.synths.map((x, n) =>
                      n === i ? { ...s, name: e.target.value } : x,
                    ),
                  })
                }
              >
                {itemSources.map((it) => (
                  <option key={it.name} value={it.name}>
                    {it.name}
                  </option>
                ))}
              </select>
              <Input
                className="w-24"
                type="number"
                min={1}
                value={s.count}
                aria-label={t("editor.itemCount")}
                onChange={(e) =>
                  onChange({
                    ...stage,
                    synths: stage.synths.map((x, n) =>
                      n === i
                        ? { ...s, count: Math.max(1, Math.floor(Number(e.target.value) || 1)) }
                        : x,
                    ),
                  })
                }
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({ ...stage, synths: stage.synths.filter((_, n) => n !== i) })
                }
                aria-label={t("editor.remove")}
              >
                ×
              </Button>
            </div>
          ) : null,
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() =>
            onChange({
              ...stage,
              synths: [...stage.synths, { kind: "item", name: itemSources[0].name, count: 1 }],
            })
          }
        >
          {t("editor.addItem")}
        </Button>
      </div>
      {spheres > 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          {t("editor.spheres", { n: spheres })}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange({ ...stage, synths: stage.synths.filter((s) => s.kind !== "sphere") })
            }
          >
            {t("editor.removeSpheres")}
          </Button>
        </p>
      )}
    </div>
  );
}

// ---------------- the editor ----------------

interface Props {
  initial: Guide;
  /** True when the guide already exists in the profile (affects the "unsaved" hint only). */
  persisted: boolean;
  onSave: (g: Guide) => void;
}

export function GuideEditor({ initial, persisted, onSave }: Props) {
  const t = useTranslations();
  const [draft, setDraft] = useState<Guide>(initial);
  const [saved, setSaved] = useState(persisted);
  useEffect(() => {
    setDraft(initial);
    setSaved(persisted);
  }, [initial, persisted]);
  const update = (patch: Partial<Guide>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };
  const setStep = (i: number, s: Step) =>
    update({ steps: draft.steps.map((x, n) => (n === i ? s : x)) });
  const derived = useMemo(() => deriveBuild(draft), [draft]);

  // Which weapons a build step may use: the first stage can be any weapon the start state can reach; later ones follow the chain.
  const buildSteps = draft.steps.filter((s) => s.build);
  const lastBuildWeapon = buildSteps.at(-1)?.build?.weaponId ?? draft.build?.weaponId;
  const allowedFor = (stepIndex: number): Set<string> => {
    const before = draft.steps.slice(0, stepIndex).filter((s) => s.build);
    const prev = before.at(-1)?.build?.weaponId;
    // The first stage is the start weapon itself; every later stage is a build-up target of the previous one.
    if (!prev) return new Set(draft.build ? [draft.build.weaponId] : []);
    return new Set(getWeapon(prev).buildsUpTo);
  };

  const addBuild = () => {
    const w = getWeapon("battle-wrench");
    update({ build: toStart(freshState(w), 1) });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3">
        <Label className="flex flex-col items-start gap-1">
          {t("editor.title")}
          <Input
            value={draft.title}
            maxLength={200}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Label>
        <Label className="flex flex-col items-start gap-1">
          {t("editor.description")}
          <Input
            value={draft.description ?? ""}
            maxLength={2000}
            onChange={(e) => update({ description: e.target.value || undefined })}
          />
        </Label>
      </div>

      <section className="flex flex-col gap-3 rounded-md border p-3">
        <h3 className="font-medium">{t("editor.build")}</h3>
        {!draft.build ? (
          <Button variant="outline" className="w-fit" onClick={addBuild}>
            {t("editor.addBuild")}
          </Button>
        ) : (
          <>
            <Label className="flex flex-col items-start gap-1 text-sm">
              {t("editor.startWeapon")}
              <WeaponSelect
                value={draft.build.weaponId}
                onChange={(id) =>
                  update({
                    build: toStart(
                      freshState(getWeapon(id)),
                      draft.build!.spBonus,
                      draft.build!.acquire,
                    ),
                  })
                }
              />
            </Label>
            <StartSpecs
              state={toState(draft.build)}
              onChange={(s) =>
                update({ build: toStart(s, draft.build!.spBonus, draft.build!.acquire) })
              }
            />
            <Label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.build.spBonus === 1}
                onChange={(e) =>
                  update({ build: { ...draft.build!, spBonus: e.target.checked ? 1 : 0 } })
                }
              />
              {t("editor.spBonus")}
            </Label>
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => {
                if (!confirm(t("editor.removeBuildConfirm"))) return;
                const { build: _b, ...rest } = draft;
                setDraft({ ...rest, steps: draft.steps.filter((s) => !s.build) });
                setSaved(false);
              }}
            >
              {t("editor.removeBuild")}
            </Button>
          </>
        )}
      </section>

      {draft.steps.map((s, i) => {
        const sections = s.chapterId ? sectionsOf(s.chapterId) : [];
        return (
          <Card key={s.id} size="sm">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>{t("editor.step", { n: i + 1 })}</span>
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={i === 0}
                    onClick={() => update({ steps: move(draft.steps, i, i - 1) })}
                    aria-label={t("editor.moveUp")}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={i === draft.steps.length - 1}
                    onClick={() => update({ steps: move(draft.steps, i, i + 1) })}
                    aria-label={t("editor.moveDown")}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => update({ steps: draft.steps.filter((_, n) => n !== i) })}
                  >
                    {t("editor.remove")}
                  </Button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Label className="flex flex-col items-start gap-1 text-xs">
                  {t("editor.chapter")}
                  <select
                    className={`${selectClass} h-9`}
                    value={s.chapterId ?? ""}
                    onChange={(e) =>
                      setStep(i, {
                        ...s,
                        chapterId: e.target.value || undefined,
                        sectionId: undefined,
                      })
                    }
                  >
                    <option value="">{t("editor.anyChapter")}</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.phase === "main" ? `${c.number}. ` : ""}
                        {c.title}
                      </option>
                    ))}
                  </select>
                </Label>
                <Label className="flex flex-col items-start gap-1 text-xs">
                  {t("editor.section")}
                  <select
                    className={`${selectClass} h-9`}
                    value={s.sectionId ?? ""}
                    disabled={!s.chapterId}
                    onChange={(e) => setStep(i, { ...s, sectionId: e.target.value || undefined })}
                  >
                    <option value="">{t("editor.noSection")}</option>
                    {sections.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
              <Label className="flex flex-col items-start gap-1 text-xs">
                {t("editor.stepTitle")}
                <Input
                  value={s.title}
                  maxLength={200}
                  onChange={(e) => setStep(i, { ...s, title: e.target.value })}
                />
              </Label>
              <Label className="flex flex-col items-start gap-1 text-xs">
                {t("editor.notes")}
                <textarea
                  className="bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={20000}
                  value={s.notes}
                  onChange={(e) => setStep(i, { ...s, notes: e.target.value })}
                />
              </Label>
              {s.build && (
                <>
                  <StageEditor
                    stage={s.build}
                    allowed={allowedFor(i)}
                    onChange={(stage) => setStep(i, { ...s, build: stage })}
                  />
                  <BuildStepBody step={s} derived={derived.steps.get(s.id)} />
                </>
              )}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-muted-foreground mb-1 text-xs">
                  {t("editor.entries")}
                </legend>
                {s.entries.map((e, n) => (
                  <EntryRow
                    key={e.kind === "text" ? e.id : `${e.kind}:${e.ref}:${n}`}
                    entry={e}
                    first={n === 0}
                    last={n === s.entries.length - 1}
                    onChange={(next) =>
                      setStep(i, { ...s, entries: s.entries.map((x, m) => (m === n ? next : x)) })
                    }
                    onRemove={() =>
                      setStep(i, { ...s, entries: s.entries.filter((_, m) => m !== n) })
                    }
                    onMove={(d) => setStep(i, { ...s, entries: move(s.entries, n, n + d) })}
                  />
                ))}
                <AddEntries
                  chapterId={s.chapterId}
                  onAdd={(add) =>
                    setStep(i, { ...s, entries: [...s.entries, ...add].slice(0, 300) })
                  }
                />
              </fieldset>
            </CardContent>
          </Card>
        );
      })}

      {derived.errors.length > 0 && (
        <ul className="text-destructive list-disc pl-5 text-sm">
          {derived.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            update({ steps: [...draft.steps, emptyStep(draft.steps.at(-1)?.chapterId)] })
          }
        >
          {t("editor.addStep")}
        </Button>
        {draft.build && (
          <Button
            variant="outline"
            onClick={() => {
              const w = lastBuildWeapon ?? draft.build!.weaponId;
              // A new stage builds up from the previous one, so default to its first build-up target.
              const weaponId = buildSteps.length ? (getWeapon(w).buildsUpTo[0] ?? w) : w;
              const stage: Stage = { weaponId, levelTo: 0, synths: [] };
              const step: Step = {
                ...emptyStep(draft.steps.at(-1)?.chapterId),
                title: getWeapon(weaponId).name,
                build: stage,
              };
              update({ steps: [...draft.steps, step] });
            }}
          >
            {t("editor.addBuildStep")}
          </Button>
        )}
        <Button
          onClick={() => {
            onSave(draft);
            setSaved(true);
          }}
          disabled={!draft.title.trim()}
        >
          {t("editor.save")}
        </Button>
        <Button variant="ghost" onClick={() => setDraft(initial)} disabled={saved}>
          {t("editor.discard")}
        </Button>
        {!saved && <span className="text-muted-foreground text-xs">{t("editor.unsaved")}</span>}
      </div>
    </div>
  );
}

export { sectionById };
