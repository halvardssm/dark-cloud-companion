import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { GuideEditor } from "@/components/guide/GuideEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n";
import { allGuides, builtinGuideById } from "@/lib/guide/builtin";
import { $draft } from "@/lib/guide/draft";
import { duplicateGuide, emptyGuide } from "@/lib/guide/ops";
import type { Guide } from "@/lib/guide/types";
import { $profile, saveGuide } from "@/lib/store";
import { selectClass } from "./WeaponSelect";

/** Creates or edits a guide. Drafts handed over by the generator open here without being saved. */
export function EditorSection() {
  const t = useTranslations();
  const profile = useStore($profile);
  const draft = useStore($draft);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);

  // ?edit=<id> opens one of the user's guides; ?new shows the creation form.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("edit");
    if (!id) return;
    const own = profile.guides.find((g) => g.id === id);
    if (own) $draft.set({ guide: own, persisted: true });
    // Built-in guides are read-only: open an editable copy instead.
    else if (builtinGuideById.has(id))
      $draft.set({ guide: duplicateGuide(builtinGuideById.get(id)!), persisted: false });
    // Only on first load of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!draft) {
    return (
      <form
        className="flex max-w-xl flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const template = allGuides(profile.guides).find((g) => g.id === templateId);
          const g: Guide = template
            ? duplicateGuide(template, title.trim())
            : emptyGuide(title.trim());
          $draft.set({ guide: g, persisted: false });
        }}
      >
        <h3 className="text-lg font-semibold">{t("editor.new")}</h3>
        <Label className="flex flex-col items-start gap-1">
          {t("editor.title")}
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Label>
        <Label className="flex flex-col items-start gap-1">
          {t("editor.startFrom")}
          <select
            className={selectClass}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">{t("editor.blank")}</option>
            {allGuides(profile.guides).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Label>
        <Button type="submit" className="w-fit" disabled={!title.trim()}>
          {t("editor.create")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GuideEditor
        initial={draft.guide}
        persisted={draft.persisted}
        onSave={(g) => {
          saveGuide(g);
          $draft.set({ guide: { ...g, kind: "custom" }, persisted: true });
          setSavedMessage(true);
        }}
      />
      {savedMessage && (
        <p className="text-sm" role="status">
          {t("editor.saved")}{" "}
          <a className="underline" href={`/guides/view?id=${encodeURIComponent(draft.guide.id)}`}>
            {t("guides.open")}
          </a>
        </p>
      )}
      <Button variant="ghost" className="w-fit" onClick={() => $draft.set(null)}>
        {t("editor.new")}
      </Button>
    </div>
  );
}
