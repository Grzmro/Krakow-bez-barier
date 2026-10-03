"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretRight, Database, Gavel, List, PersonArmsSpread, ShieldCheck, type Icon } from "@phosphor-icons/react";
import {
  Button,
  LogoMark,
  VaulDrawer,
  VaulDrawerContent,
  VaulDrawerDescription,
  VaulDrawerTitle,
  VaulDrawerTrigger,
} from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { routes } from "@/lib/routes";

const t = pl.common;

const MENU: { href: string; icon: Icon; title: string; sub: string }[] = [
  { href: routes.aboutData, icon: Database, title: t.menu.aboutData, sub: t.menu.aboutDataSub },
  { href: routes.moderator, icon: Gavel, title: t.menu.moderator, sub: t.menu.moderatorSub },
  { href: routes.privacy, icon: ShieldCheck, title: t.menu.privacy, sub: t.menu.privacySub },
  { href: routes.accessibility, icon: PersonArmsSpread, title: t.menu.a11y, sub: t.menu.a11ySub },
];

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <VaulDrawer open={menuOpen} onOpenChange={setMenuOpen}>
        <nav aria-label={t.layout.mainNav} className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
          <Link
            href={routes.home}
            aria-label={t.layout.homeLink}
            className="flex min-h-12 items-center gap-2.5 rounded-full pr-2"
          >
            <LogoMark className="size-9" />
            <span aria-hidden className="font-display text-title font-extrabold">
              {t.app.name}
            </span>
          </Link>
          <VaulDrawerTrigger asChild>
            <Button variant="outline" size="icon" className="ml-auto" aria-label={t.layout.openMenu}>
              <List weight="bold" />
            </Button>
          </VaulDrawerTrigger>
        </nav>
        <VaulDrawerContent>
          <div className="overflow-y-auto px-3 pt-3 pb-5">
            <VaulDrawerTitle className="px-1 font-display text-h2 font-bold">{t.menu.title}</VaulDrawerTitle>
            <VaulDrawerDescription className="sr-only">{t.menu.description}</VaulDrawerDescription>
            <ul className="mt-3 space-y-1">
              {MENU.map(({ href, icon: I, title, sub }) => (
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
          </div>
        </VaulDrawerContent>
      </VaulDrawer>
    </header>
  );
}
