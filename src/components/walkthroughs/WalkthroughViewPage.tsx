import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { downloadContent, fileSafe } from "@/components/ContentTransfer";
import { GuideToggle } from "@/components/guides/GuideToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import { $checks, $profile } from "@/lib/store";
import { walkthroughProgress } from "@/lib/walkthroughs/types";
import { WalkthroughStepCard } from "./WalkthroughSteps";

export function WalkthroughViewPage() {
  const t = useTranslations();
  const { walkthroughs } = useStore($profile);
  const checks = useStore($checks);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(location.search).get("id")), []);
  const w = walkthroughs.find((x) => x.id === id);
  if (!w) return <p className="text-sm">{t("wt.notFound")}</p>;
  const p = walkthroughProgress(w, checks);
  const q = `?id=${encodeURIComponent(w.id)}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{w.title}</h1>
      {w.description && <p className="text-muted-foreground text-sm">{w.description}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{t("wt.progress", { done: p.done, total: p.total })}</Badge>
        <GuideToggle guideId={w.id} labelKey="wt.show" />
        <Button variant="outline" size="sm" render={<a href={`/walkthroughs/edit${q}`} />}>
          {t("wt.edit")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadContent(`dcc-walkthrough-${fileSafe(w.title)}.json`, [], [w])}
        >
          {t("transfer.export")}
        </Button>
      </div>
      <ol className="flex flex-col gap-3">
        {w.steps.map((s, i) => (
          <li key={s.id}>
            <WalkthroughStepCard walkthrough={w} step={s} index={i} />
          </li>
        ))}
      </ol>
    </div>
  );
}
