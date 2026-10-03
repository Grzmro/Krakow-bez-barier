"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import {
  CaretRight,
  ChartBar,
  Crosshair,
  Database,
  List,
  Path,
  PersonArmsSpread,
  ShieldCheck,
  Storefront,
  type Icon,
} from "@phosphor-icons/react";
import {
  Button,
  LogoMark,
  VaulDrawer,
  VaulDrawerContent,
  VaulDrawerDescription,
  VaulDrawerTitle,
  VaulDrawerTrigger,
} from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { isPlainClick, requestHomeReset } from "@/lib/back-navigation";
import { isDetailRoute, isWidgetRoute, routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { BackButton } from "./back-button";
import { LanguageSwitch } from "./language-switch";
import { NearMe } from "./near-me";

const menu = (t: Messages["common"]): { href: string; icon: Icon; title: string; short?: string; sub: string }[] => [
  { href: routes.route(), icon: Path, title: t.menu.route, sub: t.menu.routeSub },
  { href: routes.aboutData, icon: Database, title: t.menu.aboutData, sub: t.menu.aboutDataSub },
  {
    href: routes.business,
    icon: Storefront,
    title: t.menu.business,
    short: t.menu.businessShort,
    sub: t.menu.businessSub,
  },
  { href: routes.city, icon: ChartBar, title: t.menu.city, sub: t.menu.citySub },
  { href: routes.privacy, icon: ShieldCheck, title: t.menu.privacy, sub: t.menu.privacySub },
  { href: routes.accessibility, icon: PersonArmsSpread, title: t.menu.a11y, sub: t.menu.a11ySub },
];

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const navLink =
  "press flex min-h-10 items-center gap-2 rounded-full px-3 text-[14px] font-semibold whitespace-nowrap hover:bg-muted aria-[current=page]:bg-primary-container";

/** Desktop only: "W mojej okolicy" opens in a popover, as the phone menu shows it as its first card. */
function NearMePopover() {
  const t = useMessages().nearby;
  return (
    <Popover.Root>
      <Popover.Trigger className={cn(navLink, "cursor-pointer border border-border")}>
        <Crosshair weight="bold" className="size-4 shrink-0" aria-hidden />
        <span className="sr-only xl:not-sr-only">{t.action}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-40">
          <Popover.Popup
            aria-label={t.action}
            className="w-[min(24rem,calc(100vw-2rem))] rounded-[20px] bg-card p-2 shadow-sheet ring-1 ring-border outline-none"
          >
            <NearMe />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AppHeader() {
  const t = useMessages().common;
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  if (isWidgetRoute(pathname)) return null;
  // Detail pages have no back control of their own; it sits here so it stays in reach while the page scrolls.
  const showBack = isDetailRoute(pathname);
  return (
    <header className="sticky top-[env(safe-area-inset-top)] z-30 border-b border-border bg-background print:hidden">
      <VaulDrawer open={menuOpen} onOpenChange={setMenuOpen}>
        <nav aria-label={t.layout.mainNav} className="flex h-16 w-full items-center gap-3 px-4 lg:gap-4 lg:px-8">
          {showBack ? <BackButton label={t.app.back} /> : null}
          <Link
            href={routes.home}
            aria-label={t.layout.homeLink}
            onClick={(event) => {
              if (pathname !== routes.home || !isPlainClick(event)) return;
              // Already home: a link to itself would do nothing, so the logo returns the map to its starting view.
              event.preventDefault();
              requestHomeReset();
            }}
            className="flex min-h-12 items-center gap-2.5 rounded-full pr-2"
          >
            <LogoMark className="size-9" />
            <span
              aria-hidden
              className={cn("font-display text-title font-extrabold lg:max-xl:sr-only", showBack && "max-[25rem]:hidden")}
            >
              {t.app.name}
            </span>
          </Link>
          <ul className="hidden min-w-0 items-center gap-1 lg:flex">
            {menu(t)
              .filter(({ href }) => href !== routes.city)
              .map(({ href, title, short }) => (
                <li key={href}>
                  <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} className={navLink}>
                    {short ?? title}
                  </Link>
                </li>
              ))}
          </ul>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <NearMePopover />
            <Link
              href={routes.city}
              aria-current={isCurrent(pathname, routes.city) ? "page" : undefined}
              title={t.menu.city}
              className={cn(navLink, "border border-border")}
            >
              <ChartBar weight="bold" className="size-4 shrink-0" aria-hidden />
              <span className="sr-only 2xl:not-sr-only">{t.menu.city}</span>
            </Link>
            <LanguageSwitch compact />
          </div>
          <VaulDrawerTrigger asChild>
            <Button variant="outline" size="icon" className="ml-auto lg:hidden" aria-label={t.layout.openMenu}>
              <List weight="bold" />
            </Button>
          </VaulDrawerTrigger>
        </nav>
        <VaulDrawerContent>
          <div className="overflow-y-auto px-3 pt-3 pb-5">
            <VaulDrawerTitle className="px-1 font-display text-h2 font-bold">{t.menu.title}</VaulDrawerTitle>
            <VaulDrawerDescription className="sr-only">{t.menu.description}</VaulDrawerDescription>
            <div className="mt-3">
              <NearMe />
            </div>
            <ul className="mt-3 space-y-1">
              {menu(t).map(({ href, icon: I, title, sub }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="press flex min-h-16 w-full items-center gap-3.5 rounded-2xl px-2 text-left hover:bg-muted"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-container text-primary">
                      <I weight="duotone" className="size-[22px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">{title}</span>
                      <span className="block text-caption text-muted-foreground">{sub}</span>
                    </span>
                    <CaretRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <LanguageSwitch className="mt-4 px-2" />
          </div>
        </VaulDrawerContent>
      </VaulDrawer>
    </header>
  );
}
