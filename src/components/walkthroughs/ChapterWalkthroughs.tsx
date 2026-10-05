import { useStore } from "@nanostores/react";
import { useTranslations } from "@/i18n";
import { $profile } from "@/lib/store";
import { WalkthroughStepCard } from "./WalkthroughSteps";

/** Steps of the profile's active walkthroughs that belong to this chapter (shown when the layer is on). */
export function ChapterWalkthroughs({ chapterId }: { chapterId: string }) {
  const t = useTranslations();
  const { walkthroughs, activeGuides, view } = useStore($profile);
  if (!view.layers.walkthrough) return null;
  const blocks = walkthroughs
    .filter((w) => activeGuides.includes(w.id))
    .map((w) => ({
      w,
      steps: w.steps
        .map((step, index) => ({ step, index }))
        .filter((x) => x.step.chapterId === chapterId),
    }))
    .filter((b) => b.steps.length > 0);
  if (!blocks.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("view.walkthrough")}</h2>
      {blocks.map(({ w, steps }) => (
        <div key={w.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            <a
              className="hover:underline"
              href={`/walkthroughs/view?id=${encodeURIComponent(w.id)}`}
            >
              {w.title}
            </a>
          </h3>
          {steps.map(({ step, index }) => (
            <WalkthroughStepCard key={step.id} walkthrough={w} step={step} index={index} />
          ))}
        </div>
      ))}
    </section>
  );
}
