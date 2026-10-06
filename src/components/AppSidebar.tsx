import { useStore } from "@nanostores/react";
import { withBase } from "@/lib/base";
import { useEffect, useState } from "react";
import {
  BookOpenIcon,
  ChevronsUpDownIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  MoonIcon,
  RouteIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTranslations } from "@/i18n";
import { MAIN_GUIDE_ID } from "@/lib/guide/main";
import { $ready, $state, switchProfile } from "@/lib/store";

type NavChild = { title: string; href: string };
type NavItem = { title: string; href: string; icon: LucideIcon; children?: NavChild[] };

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
}

const isActive = (href: string, pathname: string) => {
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
};

/** Top-level section link with its sub-items always visible while expanded (sidebar-03 structure). */
function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active =
    isActive(item.href, pathname) || (item.children ?? []).some((c) => isActive(c.href, pathname));
  const activeClasses =
    "data-active:border-2 data-active:border-sidebar-border data-active:shadow-sticker";

  let button: React.ReactNode;
  if (collapsed && item.children) {
    // In the icon rail a section with children opens a dropdown instead of its page link.
    button = (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton isActive={active} tooltip={item.title} className={activeClasses}>
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent side="right" align="start" className="min-w-44">
          <DropdownMenuItem render={<a href={withBase(item.href)} />}>
            {item.title}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {item.children.map((child) => (
            <DropdownMenuItem key={child.href} render={<a href={withBase(child.href)} />}>
              {child.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else {
    button = (
      <SidebarMenuButton
        render={<a href={withBase(item.href)} />}
        isActive={active}
        tooltip={item.title}
        className={`font-medium ${activeClasses}`}
      >
        <item.icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuItem>
      {button}
      {item.children && (
        <SidebarMenuSub className="border-l-2">
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              <SidebarMenuSubButton
                render={<a href={withBase(child.href)} />}
                isActive={isActive(child.href, pathname)}
                className="data-active:border-2 data-active:border-sidebar-border data-active:shadow-sticker-sm"
              >
                <span>{child.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

function NavUser() {
  const t = useTranslations();
  const ready = useStore($ready);
  const state = useStore($state);
  // Profile names come from localStorage: render a placeholder until mounted (matches the server).
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const profiles = Object.values(state.profiles);
  const current = state.profiles[state.activeProfile];
  const name = mounted && ready && current ? current.name : t("nav.profile");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const avatar = (
    <Avatar className="size-8 rounded-md border-2 border-border bg-secondary">
      <AvatarFallback className="rounded-md bg-transparent text-xs font-bold text-secondary-foreground">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            tooltip={t("nav.profile")}
            className="data-open:bg-sidebar-accent"
          />
        }
      >
        {avatar}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{t("nav.profile")}</span>
        </span>
        <ChevronsUpDownIcon className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        {/* The label is a Menu.GroupLabel and must sit inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            {avatar}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{t("profiles.title")}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {mounted && ready && profiles.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {profiles.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => switchProfile(p.id)}>
                  {p.id === state.activeProfile ? "✓ " : ""}
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href={withBase("/settings")} />}>
          {t("nav.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={withBase("/about")} />}>
          {t("nav.about")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            applyTheme(!dark);
            setDark(!dark);
          }}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
          {dark ? t("theme.light") : t("theme.dark")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The flat, always-visible app navigation (collapses to an icon rail). */
export function AppSidebar({ pathname }: { pathname: string }) {
  const t = useTranslations();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const items: NavItem[] = [
    { title: t("nav.dashboard"), href: "/", icon: LayoutDashboardIcon },
    {
      title: t("nav.guides"),
      href: "/guides",
      icon: BookOpenIcon,
      children: [
        { title: t("nav.main"), href: `/guides/view?id=${MAIN_GUIDE_ID}` },
        { title: t("guides.custom"), href: "/guides" },
      ],
    },
    { title: t("nav.planner"), href: "/planner", icon: RouteIcon },
    {
      title: t("nav.reference"),
      href: "/weapons",
      icon: DatabaseIcon,
      children: [
        { title: t("nav.weapons"), href: "/weapons" },
        { title: t("nav.items"), href: "/items" },
        { title: t("nav.ridepod"), href: "/ridepod" },
        { title: t("nav.monsters"), href: "/monsters" },
        { title: t("nav.spheda"), href: "/spheda" },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r-2">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<a href={withBase("/")} />}
              tooltip={t("app.name")}
              className="font-medium"
            >
              <img src={withBase("/logo.svg")} alt="" className="size-8 shrink-0" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-semibold">{t("app.short")}</span>
                <span className="truncate text-xs text-muted-foreground">{t("app.tagline")}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
