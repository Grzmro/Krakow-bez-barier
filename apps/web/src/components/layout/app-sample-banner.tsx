"use client";

import { usePathname } from "next/navigation";
import { SampleBanner } from "@/components/kbb";
import { isWidgetRoute } from "@/lib/routes";

/** The app-wide sample-data banner; the widget card carries its own PRZYKŁAD tag instead. */
export function AppSampleBanner() {
  const pathname = usePathname();
  if (isWidgetRoute(pathname)) return null;
  return <SampleBanner />;
}
