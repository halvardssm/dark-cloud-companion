import { useStore } from "@nanostores/react";
import { useState } from "react";
import { ContentTransfer, downloadGuides, fileSafe } from "@/components/ContentTransfer";
import { GuideToggle } from "@/components/guide/GuideToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { builtinGuides } from "@/lib/guide/builtin";
import { duplicateGuide } from "@/lib/guide/ops";
import { guideProgress } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";
import { $checks, $profile, deleteGuide, saveGuide } from "@/lib/store";

function GuideCard({ guide }: { guide: Guide }) {
  const t = useTranslations();
  const checks = useStore($checks);
  const p = guideProgress(guide, checks);
  const mine = guide.kind === "custom";
  const q = encodeURIComponent(guide.id);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <a className="hover:underline" href={`/guides/view?id=${q}`}>
            {guide.title}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {guide.description && <p className="text-muted-foreground text-xs">{guide.description}</p>}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t("step.progress", { done: p.done, total: p.total })}</Badge>
          {guide.build && <Badge variant="secondary">{t("guides.hasBuild")}</Badge>}
        </div>
        <GuideToggle guideId={guide.id} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/guides/view?id=${q}`} />}
          >
            {t("guides.open")}
          </Button>
          {mine && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/planner?edit=${q}`} />}
            >
              {t("guides.edit")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const copy = duplicateGuide(guide);
              saveGuide(copy);
              location.href = `/planner?edit=${encodeURIComponent(copy.id)}`;
            }}
          >
            {t("guides.duplicate")}
          </Button>
          {mine && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadGuides(`dcc-guide-${fileSafe(guide.title)}.json`, [guide])}
            >
              {t("transfer.export")}
            </Button>
          )}
          {mine && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirm(t("guides.deleteConfirm")) && deleteGuide(guide.id)}
            >
              {t("guides.delete")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function GuidesPage() {
  const t = useTranslations();
  const { guides } = useStore($profile);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (g: Guide) => !needle || g.title.toLowerCase().includes(needle);
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground text-sm">{t("guides.intro")}</p>
      <input
        type="search"
        className="bg-background h-9 max-w-xs rounded-md border px-3 text-sm"
        placeholder={t("guides.search")}
        aria-label={t("guides.search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("guides.custom")}</h2>
          <Button size="sm" nativeButton={false} render={<a href="/planner?new" />}>
            {t("guides.new")}
          </Button>
        </div>
        {guides.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("guides.customEmpty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {guides.filter(match).map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        )}
        <ContentTransfer />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("guides.builtin")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {builtinGuides.filter(match).map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
