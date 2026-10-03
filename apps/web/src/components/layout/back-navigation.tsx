"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onNativeBack } from "@/lib/native/back-button";
import { dismissTopLayer, hasInAppHistory, notePageChange, notePop, runBackHandlers, systemBack } from "@/lib/back-navigation";
import { routes } from "@/lib/routes";

/** Tracks in-app history for the back buttons and handles Android's system back button. Renders nothing. */
export function BackNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    window.addEventListener("popstate", notePop);
    return () => window.removeEventListener("popstate", notePop);
  }, []);

  useEffect(() => {
    notePageChange(pathname);
  }, [pathname]);

  useEffect(
    () =>
      onNativeBack((exit) =>
        systemBack({
          dismissTopLayer,
          runBackHandlers,
          hasInAppHistory,
          atHome: window.location.pathname === routes.home,
          back: () => router.back(),
          home: () => router.replace(routes.home),
          exit,
        }),
      ),
    [router],
  );

  return null;
}
