"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route, RouteRequest } from "@krakow-bez-barier/contracts";
import { api } from "./api";
import type { ProfileSettings } from "./profile/thresholds";

export type RouteKind = Route["kind"];

/** Why there is no route: none exists between the points (422), or the routing provider is down (502, 5xx). */
export class RouteError extends Error {
  constructor(readonly reason: "no_route" | "unavailable") {
    super(reason);
    this.name = "RouteError";
  }
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
  return useQuery({
    queryKey: ["route", body],
    queryFn: async () => {
      const { data, response } = await api.POST("/routes", { body: body! });
      if (data) return data;
      throw new RouteError(response.status === 422 ? "no_route" : "unavailable");
    },
    enabled: body !== null,
    retry: false,
    staleTime: Infinity,
  });
}
