"use client";

import { useCallback, useRef, useState } from "react";
import type { Outage, OutageEquipment, OutageVote } from "@krakow-bez-barier/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { isActiveOutage } from "@/domain/outages";
import { api } from "./api";

const voteKey = (outageId: string, vote: OutageVote) => `${outageId}|${vote}`;

/**
 * Reporting outages of a place's lift or ramp and voting on them ("Potwierdzam awarię" / "Działa"). Outages are not
 * moderated, so each change refetches the card and the outage shows for every visitor at once. Votes this visitor gave
 * in this session are remembered, so the card doesn't offer them again (the API refuses repeats anyway).
 */
export function usePlaceOutages(placeId: string) {
  const t = useMessages().place.breakdown;
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [given, setGiven] = useState<Set<string>>(() => new Set());
  const busy = useRef(false);

  const tell = useCallback(
    (message: string, error = false) => {
      if (error) toast.error(message);
      else toast(message);
      announce(message);
    },
    [announce],
  );

  // The card and every list holding the place: an outage changes their verdicts.
  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["place"], predicate: (q) => q.queryKey.includes(placeId) }),
        queryClient.invalidateQueries({ queryKey: ["places"] }),
        queryClient.invalidateQueries({ queryKey: ["places-pages"] }),
      ]),
    [placeId, queryClient],
  );

  const remember = useCallback(
    (outageId: string, vote: OutageVote) => setGiven((all) => new Set(all).add(voteKey(outageId, vote))),
    [],
  );

  /** Returns the outage now listed for the equipment, or null when the report failed. */
  const report = useCallback(
    async (equipment: OutageEquipment): Promise<Outage | null> => {
      if (busy.current) return null;
      busy.current = true;
      try {
        const { data, response } = await api.POST("/places/{id}/outages", {
          params: { path: { id: placeId } },
          body: { equipment },
        });
        if (!data) {
          tell(response.status === 429 ? t.repeat : t.failed, true);
          // A stale card offered "Zgłoś awarię" for an outage this visitor already reported: show it.
          if (response.status === 429) await refresh();
          return null;
        }
        remember(data.id, "still_broken");
        tell(response.status === 201 ? t.reported : t.confirmed);
        await refresh();
        return data;
      } catch {
        tell(t.failed, true);
        return null;
      } finally {
        busy.current = false;
      }
    },
    [placeId, refresh, remember, t, tell],
  );

  /** Returns the outage after the vote, or null when the vote failed. */
  const vote = useCallback(
    async (outageId: string, kind: OutageVote): Promise<Outage | null> => {
      if (busy.current) return null;
      busy.current = true;
      try {
        const { data, response } = await api.POST("/places/{id}/outages/{outageId}/votes", {
          params: { path: { id: placeId, outageId } },
          body: { vote: kind },
        });
        if (!data) {
          if (response.status === 429) remember(outageId, kind);
          tell(response.status === 409 ? t.gone : response.status === 429 ? t.repeat : t.failed, response.status !== 409);
          if (response.status === 409) await refresh();
          return null;
        }
        remember(outageId, kind);
        tell(kind === "still_broken" ? t.confirmed : isActiveOutage(data) ? t.workingSaved : t.resolved);
        await refresh();
        return data;
      } catch {
        tell(t.failed, true);
        return null;
      } finally {
        busy.current = false;
      }
    },
    [placeId, refresh, remember, t, tell],
  );

  const hasVoted = useCallback((outageId: string, kind: OutageVote) => given.has(voteKey(outageId, kind)), [given]);

  return { report, vote, hasVoted };
}
