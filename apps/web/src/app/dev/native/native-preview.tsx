"use client";

import { useSyncExternalStore } from "react";
import { NearMe } from "@/components/layout/near-me";
import { useMessages } from "@/i18n/client";
import { appPlatform } from "@/lib/native/platform";

const noSubscription = () => () => {};

export function NativePreview() {
  const t = useMessages().nearby.devPage;
  // The platform is only known in the client (the Capacitor bridge is injected into the WebView).
  const platform = useSyncExternalStore(noSubscription, appPlatform, () => null);
  return (
    <>
      <dl className="flex gap-2 text-body">
        <dt className="font-semibold">{t.platform}:</dt>
        <dd>{platform ? t.platforms[platform] : "…"}</dd>
      </dl>
      <NearMe autoStart />
    </>
  );
}
