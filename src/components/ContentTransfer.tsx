import { useStore } from "@nanostores/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildContentExport } from "@/lib/content-file";
import { useTranslations } from "@/i18n";
import type { Guide } from "@/lib/guides/types";
import { $profile, applyContent } from "@/lib/store";
import type { Walkthrough } from "@/lib/walkthroughs/types";

export function downloadContent(filename: string, guides: Guide[], walkthroughs: Walkthrough[]) {
  const blob = new Blob([JSON.stringify(buildContentExport(guides, walkthroughs), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const fileSafe = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "export";

/** Export-all and import controls for custom guides and walkthroughs (content only, no progress). */
export function ContentTransfer() {
  const t = useTranslations();
  const { customGuides, walkthroughs } = useStore($profile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    // The validator pulls in weapon/item data, so load it only when importing.
    const { parseContentImport } = await import("@/lib/content-transfer");
    const parsed = parseContentImport(await file.text());
    if (!parsed.ok) setMessage(t("transfer.failed", { error: parsed.error }));
    else setMessage(t("transfer.done", { ...applyContent(parsed.file) }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const nothing = customGuides.length === 0 && walkthroughs.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">{t("transfer.hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={nothing}
          title={nothing ? t("transfer.empty") : undefined}
          onClick={() =>
            downloadContent("dcc-guides-and-walkthroughs.json", customGuides, walkthroughs)
          }
        >
          {t("transfer.exportAll")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          {t("transfer.import")}
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
        <p className="text-sm whitespace-pre-line" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
