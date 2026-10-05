import { useStore } from "@nanostores/react";
import { useState } from "react";
import { ContentTransfer, downloadContent, fileSafe } from "@/components/ContentTransfer";
import { GuideToggle } from "@/components/guides/GuideToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { $checks, $profile, deleteWalkthrough, saveWalkthrough } from "@/lib/store";
import { emptyWalkthrough, walkthroughProgress } from "@/lib/walkthroughs/types";

export function WalkthroughList() {
  const t = useTranslations();
  const { walkthroughs } = useStore($profile);
  const checks = useStore($checks);
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("wt.intro")}</p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const w = emptyWalkthrough(name.trim());
          saveWalkthrough(w);
          location.href = `/walkthroughs/edit?id=${encodeURIComponent(w.id)}`;
        }}
      >
        <Input
          placeholder={t("wt.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit">{t("wt.new")}</Button>
      </form>

      {walkthroughs.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("wt.empty")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {walkthroughs.map((w) => {
            const p = walkthroughProgress(w, checks);
            const q = `?id=${encodeURIComponent(w.id)}`;
            return (
              <Card key={w.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    <a className="hover:underline" href={`/walkthroughs/view${q}`}>
                      {w.title}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {w.description && (
                    <p className="text-muted-foreground text-xs">{w.description}</p>
                  )}
                  <Badge variant="outline" className="w-fit">
                    {t("wt.progress", { done: p.done, total: p.total })}
                  </Badge>
                  <GuideToggle guideId={w.id} labelKey="wt.show" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={`/walkthroughs/view${q}`} />}
                    >
                      {t("wt.view")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={`/walkthroughs/edit${q}`} />}
                    >
                      {t("wt.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadContent(`dcc-walkthrough-${fileSafe(w.title)}.json`, [], [w])
                      }
                    >
                      {t("transfer.export")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => confirm(t("wt.deleteConfirm")) && deleteWalkthrough(w.id)}
                    >
                      {t("wt.delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ContentTransfer />
    </div>
  );
}
