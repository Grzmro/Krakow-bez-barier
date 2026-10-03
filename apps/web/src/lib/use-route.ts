"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route, RouteRequest } from "@krakow-bez-barier/contracts";
import { useLocale } from "@/i18n/client";
import { api } from "./api";
import type { ProfileSettings } from "./profile/thresholds";

export type RouteKind = Route["kind"];

/** Why there is no route: none exists between the points (422), routing has no key on this server (502 `routing-not-configured`), or the provider is down. */
export class RouteError extends Error {
  constructor(readonly reason: "no_route" | "not_configured" | "unavailable") {
    super(reason);
    this.name = "RouteError";
  }
}

/** Maps a failed `POST /routes` (status and Problem body) to why there is no route. */
export function routeFailure(status: number, problem: { type?: string } | undefined): RouteError {
  if (status === 422) return new RouteError("no_route");
  const notConfigured = status === 502 && Boolean(problem?.type?.endsWith("/routing-not-configured"));
  return new RouteError(notConfigured ? "not_configured" : "unavailable");
}

/** The request for one route kind; the profile's kerb threshold and surface need go along, nothing else. */
export function routeRequest(
  from: [number, number],
  to: [number, number],
  kind: RouteKind,
  settings: ProfileSettings,
): RouteRequest {
  const profile = settings.profile;
  return {
    from: { type: "Point", coordinates: from },
    to: { type: "Point", coordinates: to },
    avoidStairs: kind === "avoid_stairs",
    ...(profile && {
      profile,
      maxThresholdCm: settings.thresholds[profile].maxThresholdCm,
      requireSmoothSurface: settings.thresholds[profile].requireSmoothSurface,
    }),
  };
}

/** `POST /routes`; routes are cached for the session, each one costs provider quota. */
export function useRoute(body: RouteRequest | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["route", locale, body],
    queryFn: async () => {
      const { data, error, response } = await api.POST("/routes", { body: body! });
      if (data) return data;
      throw routeFailure(response.status, error);
    },
    enabled: body !== null,
    retry: false,
    staleTime: Infinity,
  });
}
