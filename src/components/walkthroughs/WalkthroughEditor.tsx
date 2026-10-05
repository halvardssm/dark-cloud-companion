import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n";
import { chapters, sectionsOf } from "@/lib/data";
import { $profile, saveWalkthrough } from "@/lib/store";
import {
  emptyStep,
  newItemId,
  type Walkthrough,
  type WalkthroughStep,
} from "@/lib/walkthroughs/types";

const selectClass = "bg-background h-9 w-full rounded-md border px-2 text-sm";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function AddItems({ onAdd }: { onAdd: (texts: string[]) => void }) {
  const t = useTranslations();
  const [text, setText] = useState("");
  const submit = () => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length) onAdd(lines);
    setText("");
  };
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        value={text}
        placeholder={t("wt.editor.itemPlaceholder")}
        onChange={(e) => setText(e.target.value)}
        // Pasting several lines adds them all at once.
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/\r?\n/.test(pasted)) {
            e.preventDefault();
            onAdd(
              pasted
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean),
            );
          }
        }}
      />
      <Button type="submit" variant="outline">
        {t("wt.editor.addItem")}
      </Button>
    </form>
  );
}

function StepEditor({
  step,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  step: WalkthroughStep;
  index: number;
  count: number;
  onChange: (s: WalkthroughStep) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const sections = sectionsOf(step.chapterId);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("wt.editor.step", { n: index + 1 })}</span>
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
              aria-label={t("wt.editor.moveUp")}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={index === count - 1}
              onClick={() => onMove(index + 1)}
              aria-label={t("wt.editor.moveDown")}
            >
              ↓
            </Button>
            <Button size="sm" variant="destructive" onClick={onRemove}>
              {t("wt.editor.remove")}
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="flex flex-col items-start gap-1 text-xs">
            {t("wt.editor.chapter")}
            <select
              className={selectClass}
              value={step.chapterId}
              onChange={(e) =>
                onChange({ ...step, chapterId: e.target.value, sectionId: undefined })
              }
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.phase === "main" ? `${c.number}. ` : ""}
                  {c.title}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1 text-xs">
            {t("wt.editor.section")}
            <select
              className={selectClass}
              value={step.sectionId ?? ""}
              onChange={(e) => onChange({ ...step, sectionId: e.target.value || undefined })}
            >
              <option value="">{t("wt.editor.noSection")}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Label>
        </div>
        <Label className="flex flex-col items-start gap-1 text-xs">
          {t("wt.editor.stepTitle")}
          <Input
            value={step.title}
            maxLength={200}
            onChange={(e) => onChange({ ...step, title: e.target.value })}
          />
        </Label>
        <Label className="flex flex-col items-start gap-1 text-xs">
          {t("wt.editor.notes")}
          <textarea
            className="bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={step.notes}
            maxLength={20000}
            onChange={(e) => onChange({ ...step, notes: e.target.value })}
          />
        </Label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted-foreground mb-1 text-xs">{t("wt.editor.checklist")}</legend>
          {step.checklist.map((item, i) => (
            <div key={item.id} className="flex gap-1">
              <Input
                value={item.text}
                maxLength={500}
                aria-label={t("wt.editor.checklist")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    checklist: step.checklist.map((x) =>
                      x.id === item.id ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
              />
              <Button
                size="sm"
                variant="outline"
                disabled={i === 0}
                onClick={() => onChange({ ...step, checklist: move(step.checklist, i, i - 1) })}
                aria-label={t("wt.editor.moveUp")}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={i === step.checklist.length - 1}
                onClick={() => onChange({ ...step, checklist: move(step.checklist, i, i + 1) })}
                aria-label={t("wt.editor.moveDown")}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({ ...step, checklist: step.checklist.filter((x) => x.id !== item.id) })
                }
                aria-label={t("wt.editor.remove")}
              >
                ×
              </Button>
            </div>
          ))}
          <AddItems
            onAdd={(texts) =>
              onChange({
                ...step,
                checklist: [
                  ...step.checklist,
                  ...texts.map((text) => ({ id: newItemId(), text: text.slice(0, 500) })),
                ].slice(0, 200),
              })
            }
          />
        </fieldset>
      </CardContent>
    </Card>
  );
}

/** Client-only editor; every change is saved straight to the active profile. */
export function WalkthroughEditor() {
  const t = useTranslations();
  const { walkthroughs } = useStore($profile);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(location.search).get("id")), []);
  const w = walkthroughs.find((x) => x.id === id);
  if (!w) return <p className="text-sm">{t("wt.notFound")}</p>;

  const update = (patch: Partial<Walkthrough>) => saveWalkthrough({ ...w, ...patch });
  const setStep = (i: number, s: WalkthroughStep) =>
    update({ steps: w.steps.map((x, n) => (n === i ? s : x)) });

  return (
    <div className="flex flex-col gap-4">
      <Label className="flex flex-col items-start gap-1">
        {t("wt.editor.title")}
        <Input
          value={w.title}
          maxLength={200}
          onChange={(e) => update({ title: e.target.value || w.title })}
        />
      </Label>
      <Label className="flex flex-col items-start gap-1">
        {t("wt.editor.description")}
        <Input
          value={w.description ?? ""}
          maxLength={2000}
          onChange={(e) => update({ description: e.target.value || undefined })}
        />
      </Label>
      {w.steps.map((s, i) => (
        <StepEditor
          key={s.id}
          step={s}
          index={i}
          count={w.steps.length}
          onChange={(next) => setStep(i, next)}
          onMove={(to) => update({ steps: move(w.steps, i, to) })}
          onRemove={() => update({ steps: w.steps.filter((_, n) => n !== i) })}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            update({
              steps: [...w.steps, emptyStep(w.steps.at(-1)?.chapterId ?? "c1")].slice(0, 500),
            })
          }
        >
          {t("wt.editor.addStep")}
        </Button>
        <Button render={<a href={`/walkthroughs/view?id=${encodeURIComponent(w.id)}`} />}>
          {t("wt.editor.done")}
        </Button>
      </div>
    </div>
  );
}
