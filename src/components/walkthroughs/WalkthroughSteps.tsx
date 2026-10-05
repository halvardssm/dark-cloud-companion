import { useStore } from "@nanostores/react";
import { CheckRow } from "@/components/chapter/CheckRow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { chapterById, sectionById } from "@/lib/data";
import { $checks, setChecked } from "@/lib/store";
import {
  itemDoneId,
  stepDoneId,
  type Walkthrough,
  type WalkthroughStep,
} from "@/lib/walkthroughs/types";

export function WalkthroughStepCard({
  walkthrough,
  step,
  index,
  showWhere = true,
}: {
  walkthrough: Walkthrough;
  step: WalkthroughStep;
  index: number;
  showWhere?: boolean;
}) {
  const t = useTranslations();
  const checks = useStore($checks);
  const doneId = stepDoneId(walkthrough.id, step.id);
  const chapter = chapterById.get(step.chapterId);
  const section = step.sectionId ? sectionById.get(step.sectionId) : undefined;
  const done = !!checks[doneId];

  return (
    <Card size="sm" className={done ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={done}
            onChange={(e) => setChecked(doneId, e.target.checked)}
            aria-label={step.title || t("wt.step.untitled")}
          />
          <span>
            {index + 1}. {step.title || t("wt.step.untitled")}
          </span>
          {showWhere && chapter && (
            <Badge variant="outline">
              {chapter.phase === "main" ? `${chapter.number}. ` : ""}
              {chapter.title}
              {section ? ` › ${section.title}` : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {step.notes && <p className="text-sm whitespace-pre-wrap">{step.notes}</p>}
        {step.checklist.map((item) => (
          <CheckRow
            key={item.id}
            checked={!!checks[itemDoneId(walkthrough.id, step.id, item.id)]}
            onChange={(v) => setChecked(itemDoneId(walkthrough.id, step.id, item.id), v)}
            label={item.text}
          />
        ))}
      </CardContent>
    </Card>
  );
}
