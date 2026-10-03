"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccessibilityAttribute, ReportCreate } from "@krakow-bez-barier/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { api } from "./api";
import type { PendingEntry } from "./reports";

/** How long "Cofnij" is offered before the report is actually sent. */
export const UNDO_MS = 5000;

let seq = 0;
const nextKey = () => `mine-${++seq}`;

/**
 * The visitor's own reports and confirmations for one place. A report is held back for UNDO_MS so "Cofnij" really
 * withdraws it (there is no delete endpoint); it is sent at once if the card unmounts first. Once sent, the card is
 * refetched so the report comes back from the API (`pendingReports`) — and stays after a reload, for every visitor.
 */
export function usePlaceReports(placeId: string) {
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const queued = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>());
  const confirming = useRef(new Set<string>());
  const announce = useAnnounce();
  const t = useMessages().place;
  const queryClient = useQueryClient();

  const remove = useCallback((key: string) => setEntries((all) => all.filter((e) => e.key !== key)), []);

  const send = useCallback(
    async (key: string, body: ReportCreate) => {
      queued.current.delete(key);
      try {
        const { data } = await api.POST("/reports", { body });
        if (!data) throw new Error("createReport failed");
        setEntries((all) =>
          all.map((e) => (e.key === key ? { ...e, sending: false, reportId: data.id, createdAt: data.createdAt } : e)),
        );
        announce(t.report.sent);
        void queryClient.invalidateQueries({ queryKey: ["place"], predicate: (q) => q.queryKey.includes(placeId) });
      } catch {
        remove(key);
        toast.error(t.report.failed);
        announce(t.report.failed);
      }
    },
    [announce, placeId, queryClient, remove, t],
  );

  const submitReport = useCallback(
    (body: Omit<ReportCreate, "placeId">, valueText: string) => {
      const key = nextKey();
      const full: ReportCreate = { ...body, placeId };
      setEntries((all) => [
        ...all,
        { key, kind: "report", mine: true, attribute: body.attribute, valueText, createdAt: new Date().toISOString(), sending: true },
      ]);
      const timer = setTimeout(() => void send(key, full), UNDO_MS);
      queued.current.set(key, { timer, send: () => void send(key, full) });
      toast(t.report.thanks, {
        duration: UNDO_MS,
        action: {
          label: t.report.undo,
          onClick: () => {
            const item = queued.current.get(key);
            if (!item) {
              toast(t.report.alreadySent);
              announce(t.report.alreadySent);
              return;
            }
            clearTimeout(item.timer);
            queued.current.delete(key);
            remove(key);
            announce(t.report.undone);
          },
        },
      });
      announce(t.report.thanks);
    },
    [announce, placeId, remove, send, t],
  );

  const confirm = useCallback(
    async (attribute: AccessibilityAttribute, factId: string, valueText?: string) => {
      if (confirming.current.has(factId)) return false;
      confirming.current.add(factId);
      try {
        const { data } = await api.POST("/places/{id}/confirmations", {
          params: { path: { id: placeId } },
          body: { factId },
        });
        if (!data) throw new Error("createConfirmation failed");
        setEntries((all) => [
          ...all,
          { key: nextKey(), kind: "confirmation", mine: true, attribute, valueText, createdAt: data.createdAt, sending: false },
        ]);
        toast(t.confirmed);
        announce(t.confirmed);
        return true;
      } catch {
        toast.error(t.confirmFailed);
        announce(t.confirmFailed);
        return false;
      } finally {
        confirming.current.delete(factId);
      }
    },
    [announce, placeId, t],
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

  return { entries, submitReport, confirm };
}
