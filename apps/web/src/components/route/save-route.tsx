"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import type { Route } from "@krakow-bez-barier/contracts";
import { Button, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { routes } from "@/lib/routes";
import { saveRoute, type SavedRouteInput } from "@/lib/saved-routes";

type Outcome = { route: Route; status: "saving" | "saved" | "failed" };

/** "Zapisz na telefonie": keeps the shown route in this browser for the way, no server involved. */
export function SaveRoute({ route, input }: { route: Route; input: () => SavedRouteInput | null }) {
  const t = useMessages().route.save;
  const announce = useAnnounce();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Another route (kind, profile, ends) is shown: it hasn't been saved yet.
  const status = outcome?.route === route ? outcome.status : "idle";

  // Not `disabled` while saving: a disabled button drops keyboard focus.
  const save = async () => {
    const record = input();
    if (status === "saving" || !record) return;
    setOutcome({ route, status: "saving" });
    const saved = await saveRoute(record);
    setOutcome({ route, status: saved ? "saved" : "failed" });
    announce(saved ? t.done : t.failed);
  };

  return (
    <div className="mt-3">
      <Button variant="outline" size="sm" onClick={save}>
        <DownloadSimple weight="bold" />
        {status === "saved" ? t.again : t.button}
      </Button>
      {status === "saved" ? (
        <p className="mt-2 flex items-start gap-2 text-body-sm">
          <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            {t.done}{" "}
            <Link href={routes.savedRoutes} className="font-semibold text-primary underline underline-offset-2">
              {t.open}
            </Link>
          </span>
        </p>
      ) : status === "failed" ? (
        <p className="mt-2 flex items-start gap-2 text-body-sm">
          <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-status-conflict" aria-hidden />
          {t.failed}
        </p>
      ) : null}
    </div>
  );
}
