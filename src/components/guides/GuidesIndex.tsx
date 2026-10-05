import { useStore } from "@nanostores/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { curatedGuides } from "@/lib/guides/data";
import type { Guide } from "@/lib/guides/types";
import { $profile, removeCustomGuide } from "@/lib/store";
import { ContentTransfer, downloadContent, fileSafe } from "@/components/ContentTransfer";
import { GuideToggle } from "./GuideToggle";

function GuideCard({
  guide,
  href,
  onDelete,
}: {
  guide: Guide;
  href: string;
  onDelete?: () => void;
}) {
  const t = useTranslations();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <a href={href} className="hover:underline">
            {guide.title}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">{guide.summary}</p>
        <div className="flex flex-wrap gap-2">
          <Badge>
            {t("planner.totalAbs", { n: Math.round(guide.totals.abs).toLocaleString() })}
          </Badge>
          <Badge variant="secondary">
            {t("planner.totalGilda", { n: Math.round(guide.totals.gilda).toLocaleString() })}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GuideToggle guideId={guide.id} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" render={<a href={href} />}>
              {t("guides.open")}
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadContent(`dcc-guide-${fileSafe(guide.title)}.json`, [guide], [])
                }
              >
                {t("transfer.export")}
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                {t("guides.delete")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GuidesIndex() {
  const t = useTranslations();
  const { customGuides } = useStore($profile);
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground text-sm">{t("guides.intro")}</p>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("guides.custom")}</h2>
        {customGuides.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("guides.customEmpty")}{" "}
            <a className="underline" href="/planner">
              {t("nav.planner")}
            </a>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customGuides.map((g) => (
              <GuideCard
                key={g.id}
                guide={g}
                href={`/guides/custom?id=${encodeURIComponent(g.id)}`}
                onDelete={() => confirm(t("profiles.deleteConfirm")) && removeCustomGuide(g.id)}
              />
            ))}
          </div>
        )}
      </section>
      <ContentTransfer />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("guides.curated")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {curatedGuides.map((g) => (
            <GuideCard key={g.id} guide={g} href={`/guides/${g.id}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
