"use client";

import { usePathname } from "next/navigation";
import { SampleBanner } from "@/components/kbb";
import { isMockApi } from "@/lib/api";
import { isWidgetRoute } from "@/lib/routes";

/**
 * The app-wide sample-data banner, shown only while the app answers from the spec's examples. On the real API a
 * sample place or fact carries its own PRZYKŁAD tag; so does the widget card.
 */
export function AppSampleBanner() {
  const pathname = usePathname();
  if (!isMockApi || isWidgetRoute(pathname)) return null;
  return <SampleBanner className="print:hidden" />;
}
