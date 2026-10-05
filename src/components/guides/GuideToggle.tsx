import { useStore } from "@nanostores/react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { $profile, toggleGuide } from "@/lib/store";

export function GuideToggle({ guideId }: { guideId: string }) {
  const t = useTranslations();
  const { activeGuides } = useStore($profile);
  return (
    <Label className="flex items-center gap-2 text-sm">
      <Switch
        checked={activeGuides.includes(guideId)}
        onCheckedChange={(v) => toggleGuide(guideId, v)}
      />
      {t("guides.active")}
    </Label>
  );
}
