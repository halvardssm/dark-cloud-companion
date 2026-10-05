import { useStore } from "@nanostores/react";
import { useTranslations } from "@/i18n";
import { curatedGuideById, stepCheckId } from "@/lib/guides/data";
import { $checks, $profile } from "@/lib/store";
import { GuideStepCard } from "./GuideStepCard";

/** Steps of the profile's active guides that belong to this chapter (plus unfinished ones from earlier chapters). */
export function ChapterGuides({ chapterNumber }: { chapterNumber: number }) {
  const t = useTranslations();
  const { activeGuides, customGuides } = useStore($profile);
  const checks = useStore($checks);

  const guides = activeGuides
    .map((id) => curatedGuideById.get(id) ?? customGuides.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => !!g);

  const blocks = guides
    .map((g) => ({
      guide: g,
      steps: g.steps
        .map((step, index) => ({ step, index }))
        .filter(
          ({ step }) =>
            step.chapter === chapterNumber ||
            (step.chapter < chapterNumber && !checks[stepCheckId(g.id, step.id)]),
        ),
    }))
    .filter((b) => b.steps.length > 0);

  if (!blocks.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("guides.inChapter")}</h2>
      {blocks.map(({ guide, steps }) => (
        <div key={guide.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            <a
              className="hover:underline"
              href={
                guide.kind === "curated"
                  ? `/guides/${guide.id}`
                  : `/guides/custom?id=${encodeURIComponent(guide.id)}`
              }
            >
              {guide.title}
            </a>
          </h3>
          {steps.map(({ step, index }) => (
            <GuideStepCard
              key={step.id}
              step={step}
              index={index}
              checkId={stepCheckId(guide.id, step.id)}
              showChapter={false}
              note={
                step.chapter < chapterNumber ? t("guides.carried", { n: step.chapter }) : undefined
              }
            />
          ))}
        </div>
      ))}
    </section>
  );
}
