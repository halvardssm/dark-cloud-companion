import { curatedGuideById } from "@/lib/guides/data";
import { GuideToggle } from "./GuideToggle";
import { GuideView } from "./GuideView";

export function CuratedGuidePage({ id }: { id: string }) {
  const guide = curatedGuideById.get(id)!;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{guide.title}</h1>
      <GuideToggle guideId={guide.id} />
      <GuideView guide={guide} trackProgress />
    </div>
  );
}
