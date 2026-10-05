import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n";
import { $profile } from "@/lib/store";
import { GuideToggle } from "./GuideToggle";
import { GuideView } from "./GuideView";

/** Client-only page for a guide pinned from the planner (looked up by `?id=`). */
export function CustomGuidePage() {
  const t = useTranslations();
  const { customGuides } = useStore($profile);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(location.search).get("id")), []);
  const guide = customGuides.find((g) => g.id === id);
  if (!guide) return <p className="text-sm">{t("guides.notFound")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{guide.title}</h1>
      <GuideToggle guideId={guide.id} />
      <GuideView guide={guide} trackProgress />
    </div>
  );
}
