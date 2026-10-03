"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { buttonVariants, cn } from "@krakow-bez-barier/ui";
import { hasInAppHistory, isPlainClick } from "@/lib/back-navigation";
import { routes } from "@/lib/routes";

type BackButtonProps = { label: string; fallback?: string; className?: string };

/**
 * Visible "back": the previous page of the app when there is one, otherwise `fallback` (the home
 * screen) — so a shared link opened in a new tab still has a way into the app instead of out of it.
 */
export function BackButton({ label, fallback = routes.home, className }: BackButtonProps) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      aria-label={label}
      onClick={(event) => {
        if (!isPlainClick(event) || !hasInAppHistory()) return;
        event.preventDefault();
        router.back();
      }}
      className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0 print:hidden", className)}
    >
      <CaretLeft weight="bold" aria-hidden />
    </Link>
  );
}
