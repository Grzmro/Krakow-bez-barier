"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccessibilityAttribute, Contribution, ReportCreate } from "@krakow-bez-barier/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { api } from "./api";
import { contributorToken } from "./contributor-token";
import { ownEntries, type PendingEntry } from "./reports";

/** How long "Cofnij" is offered before the report is actually sent. */
export const UNDO_MS = 5000;

let seq = 0;
const nextKey = () => `mine-${++seq}`;

const contributionsKey = (placeId: string) => ["contributions", placeId] as const;

/**
 * This device's report or confirmation per attribute of one place — at most one each, the latest wins, as the API keeps
 * it (`X-Contributor-Token`). The API's list (`GET /places/{id}/contributions`) survives a reload; a report still in its
 * UNDO_MS "Cofnij" window, or being sent, is held locally and shown instead. It is sent at once if the card unmounts.
 */
export function usePlaceReports(placeId: string) {
  const [local, setLocal] = useState<PendingEntry[]>([]);
  const queued = useRef(new Map<AccessibilityAttribute, { key: string; timer: ReturnType<typeof setTimeout>; send: () => void }>());
  const busy = useRef(new Set<AccessibilityAttribute>());
  const announce = useAnnounce();
  const t = useMessages().place;
  const locale = useLocale();
  const queryClient = useQueryClient();

  const contributions = useQuery({
    queryKey: contributionsKey(placeId),
    queryFn: async (): Promise<Contribution[]> => {
      const { data } = await api.GET("/places/{id}/contributions", {
        params: { path: { id: placeId }, header: { "X-Contributor-Token": contributorToken() } },
      });
      if (!data) throw new Error("listMyContributions failed");
      return data.items;
    },
  });

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: contributionsKey(placeId) }),
        queryClient.invalidateQueries({ queryKey: ["place"], predicate: (q) => q.queryKey.includes(placeId) }),
      ]),
    [placeId, queryClient],
  );

  const dropLocal = useCallback((key: string) => setLocal((all) => all.filter((e) => e.key !== key)), []);

  const send = useCallback(
    async (key: string, body: ReportCreate) => {
      queued.current.delete(body.attribute);
      try {
        const { data, response } = await api.POST("/reports", {
          params: { header: { "X-Contributor-Token": contributorToken() } },
          body,
        });
        if (!data) throw new Error("createReport failed");
        announce(response.status === 200 ? t.report.replaced : t.report.sent);
        await refresh();
      } catch {
        toast.error(t.report.failed);
        announce(t.report.failed);
      } finally {
        dropLocal(key);
      }
    },
    [announce, dropLocal, refresh, t],
  );

  const cancelQueued = useCallback(
    (attribute: AccessibilityAttribute) => {
      const item = queued.current.get(attribute);
      if (!item) return false;
      clearTimeout(item.timer);
      queued.current.delete(attribute);
      dropLocal(item.key);
      return true;
    },
    [dropLocal],
  );

  const submitReport = useCallback(
    (body: Omit<ReportCreate, "placeId">, valueText: string) => {
      // A second report of the same feature inside the undo window replaces the first one before it is sent.
      cancelQueued(body.attribute);
      const key = nextKey();
      const full: ReportCreate = { ...body, placeId };
      setLocal((all) => [
        ...all.filter((e) => e.attribute !== body.attribute),
        { key, kind: "report", mine: true, attribute: body.attribute, valueText, createdAt: new Date().toISOString(), sending: true },
      ]);
      const timer = setTimeout(() => void send(key, full), UNDO_MS);
      queued.current.set(body.attribute, { key, timer, send: () => void send(key, full) });
      toast(t.report.thanks, {
        duration: UNDO_MS,
        action: {
          label: t.report.undo,
          onClick: () => {
            if (queued.current.get(body.attribute)?.key !== key) {
              toast(t.report.alreadySent);
              announce(t.report.alreadySent);
              return;
            }
            cancelQueued(body.attribute);
            announce(t.report.undone);
          },
        },
      });
      announce(t.report.thanks);
    },
    [announce, cancelQueued, placeId, send, t],
  );

  const confirm = useCallback(
    async (attribute: AccessibilityAttribute, factId: string) => {
      if (busy.current.has(attribute)) return false;
      busy.current.add(attribute);
      try {
        cancelQueued(attribute);
        const { data } = await api.POST("/places/{id}/confirmations", {
          params: { path: { id: placeId }, header: { "X-Contributor-Token": contributorToken() } },
          body: { factId },
        });
        if (!data) throw new Error("createConfirmation failed");
        await refresh();
        toast(t.confirmed);
        announce(t.confirmed);
        return true;
      } catch {
        toast.error(t.confirmFailed);
        announce(t.confirmFailed);
        return false;
      } finally {
        busy.current.delete(attribute);
      }
    },
    [announce, cancelQueued, placeId, refresh, t],
  );

  const withdraw = useCallback(
    async (attribute: AccessibilityAttribute) => {
      if (busy.current.has(attribute)) return false;
      busy.current.add(attribute);
      try {
        if (!cancelQueued(attribute)) {
          const { response } = await api.DELETE("/places/{id}/contributions/{attribute}", {
            params: { path: { id: placeId, attribute }, header: { "X-Contributor-Token": contributorToken() } },
          });
          if (!response.ok) throw new Error("withdrawContribution failed");
          await refresh();
        }
        toast(t.mine.withdrawn);
        announce(t.mine.withdrawn);
        return true;
      } catch {
        toast.error(t.mine.withdrawFailed);
        announce(t.mine.withdrawFailed);
        return false;
      } finally {
        busy.current.delete(attribute);
      }
    },
    [announce, cancelQueued, placeId, refresh, t],
  );

  useEffect(() => {
    const pending = queued.current;
    return () => {
      for (const { timer, send: flush } of pending.values()) {
        clearTimeout(timer);
        flush();
      }
      pending.clear();
    };
  }, []);

  const entries = useMemo(() => ownEntries(contributions.data ?? [], local, locale), [contributions.data, local, locale]);

  return { entries, submitReport, confirm, withdraw };
}
