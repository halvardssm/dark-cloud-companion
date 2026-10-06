import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "@/i18n";
import { $ready, $state, switchProfile } from "@/lib/store";

const referenceLinks = [
  { href: "/weapons", key: "nav.weapons" },
  { href: "/items", key: "nav.items" },
  { href: "/items", key: "nav.items" },
  { href: "/ridepod", key: "nav.ridepod" },
  { href: "/monsters", key: "nav.monsters" },
  { href: "/spheda", key: "nav.spheda" },
] as const;

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
}

/** Main tabs (Dashboard, Guides, Planner, Reference menu) with the profile/settings menu on the right. */
export function NavBar({ pathname }: { pathname: string }) {
  const t = useTranslations();
  const ready = useStore($ready);
  const state = useStore($state);
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const tab = (href: string, label: string) => (
    <a
      key={href}
      href={href}
      aria-current={active(href) ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${active(href) ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </a>
  );
  const referenceActive = referenceLinks.some((l) => active(l.href));
  const profiles = Object.values(state.profiles);
  const current = state.profiles[state.activeProfile];

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={t("nav.profile")}
      >
        {ready && current ? current.name : t("nav.profile")} ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {ready && profiles.length > 1 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("profiles.active")}</DropdownMenuLabel>
              {profiles.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => switchProfile(p.id)}>
                  {p.id === state.activeProfile ? "✓ " : ""}
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem render={<a href="/settings" />}>{t("nav.settings")}</DropdownMenuItem>
        <DropdownMenuItem render={<a href="/about" />}>{t("nav.about")}</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            applyTheme(!dark);
            setDark(!dark);
          }}
        >
          {dark ? t("theme.light") : t("theme.dark")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <a href="/" className="min-w-0 truncate font-semibold">
          {t("app.name")}
        </a>
        {profileMenu}
      </div>
      <nav
        className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Main"
      >
        {tab("/", t("nav.dashboard"))}
        {tab("/guides", t("nav.guides"))}
        {tab("/planner", t("nav.planner"))}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${referenceActive ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("nav.reference")} ▾
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            {referenceLinks.map((l) => (
              <DropdownMenuItem key={l.href} render={<a href={l.href} />}>
                {t(l.key)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}
