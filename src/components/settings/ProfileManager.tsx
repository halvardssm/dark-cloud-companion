import { useStore } from "@nanostores/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import {
  $state,
  addProfile,
  buildExport,
  deleteProfile,
  importFromJson,
  renameProfile,
  switchProfile,
} from "@/lib/store";

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProfileManager() {
  const t = useTranslations();
  const state = useStore($state);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = state.profiles[state.activeProfile];
  const [renameValue, setRenameValue] = useState<string | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const err = await importFromJson(await file.text());
    setMessage(err ?? t("profiles.importOk"));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">{t("profiles.hint")}</p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("profiles.active")}</span>
        <select
          className="bg-background h-10 rounded-md border px-3 text-sm"
          value={state.activeProfile}
          onChange={(e) => switchProfile(e.target.value)}
        >
          {Object.values(state.profiles).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = renameValue ?? active.name;
          if (renameValue !== null) renameProfile(active.id, v);
          setRenameValue(null);
        }}
      >
        <Input
          value={renameValue ?? active.name}
          onChange={(e) => setRenameValue(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={renameValue === null}>
          {t("profiles.rename")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={Object.keys(state.profiles).length <= 1}
          onClick={() => confirm(t("profiles.deleteConfirm")) && deleteProfile(active.id)}
        >
          {t("profiles.delete")}
        </Button>
      </form>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addProfile(name.trim());
          setName("");
        }}
      >
        <Input
          placeholder={t("profiles.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit">{t("profiles.add")}</Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => download(`dcc-${active.name}.json`, buildExport([active.id]))}
        >
          {t("profiles.exportOne")}
        </Button>
        <Button variant="outline" onClick={() => download("dcc-all-profiles.json", buildExport())}>
          {t("profiles.exportAll")}
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          {t("profiles.import")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </div>
      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
