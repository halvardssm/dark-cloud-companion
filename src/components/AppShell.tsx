import { Fragment, useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTranslations } from "@/i18n";

type Crumb = { label: string; href?: string };

/** Breadcrumb from the pathname: section pages get their parent section as the first crumb. */
function useCrumbs(pathname: string): Crumb[] {
  const t = useTranslations();
  const [head, sub] = pathname.replace(/^\/|\/$/g, "").split("/");
  if (!head) return [{ label: t("nav.dashboard") }];

  const label =
    {
      guides: t("nav.guides"),
      planner: t("nav.planner"),
      weapons: t("nav.weapons"),
      items: t("nav.items"),
      ridepod: t("nav.ridepod"),
      monsters: t("nav.monsters"),
      spheda: t("nav.spheda"),
      settings: t("nav.settings"),
      about: t("nav.about"),
    }[head] ?? head;

  let section: Crumb | undefined;
  let child: string | undefined;
  if (head === "guides") {
    section = { label: t("nav.guides"), href: "/guides" };
    if (sub === "view") child = t("nav.guide");
  } else if (["weapons", "items", "ridepod", "monsters", "spheda"].includes(head)) {
    section = { label: t("nav.reference"), href: "/weapons" };
    if (head === "weapons" && sub) child = t("nav.weapons");
  }

  if (!section) return [{ label }];
  return child ? [section, { label: child }] : [section];
}

function AppHeader({ pathname }: { pathname: string }) {
  const { state } = useSidebar();
  const crumbs = useCrumbs(pathname);
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2 px-4 transition-[height] duration-200 ease-linear",
        state === "collapsed" ? "h-12" : "h-16",
      )}
    >
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href && i < crumbs.length - 1 ? (
                  <BreadcrumbLink render={<a href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

/**
 * Sidebar shell around every page: flat sidebar (icon rail when collapsed, sheet on mobile), a
 * slim header with a breadcrumb, and the plain page area.
 */
export function AppShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    // The sidebar persists its state in a cookie, but a static site can only read it on the client.
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
    if (match) setOpen(decodeURIComponent(match[1]) !== "false");
  }, []);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar pathname={pathname} />
      <SidebarInset>
        <AppHeader pathname={pathname} />
        <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
