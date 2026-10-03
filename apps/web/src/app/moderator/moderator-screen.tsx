"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, LockKey, Question, SignOut, XCircle } from "@phosphor-icons/react";
import type { ModerationDecisionKind, ModerationReport } from "@krakow-bez-barier/contracts";
import { Button, cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { ReliabilityBadge } from "@/components/kbb";
import { InfoSection } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";
import { api, isMockApi } from "@/lib/api";
import { changePreview, formatDateTime, isOpen, moderationHistory, retryMinutes } from "@/lib/moderation";
import { formatDate } from "@/lib/place-facts";

const t = pl.moderator;
const TOKEN_KEY = "kbb.moderatorToken";
const PAGE_SIZE = 100;

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

// The token lives in sessionStorage (this tab only); the in-memory copy covers blocked storage.
let memoryToken: string | null = null;
const tokenListeners = new Set<() => void>();

function subscribeToken(listener: () => void) {
  tokenListeners.add(listener);
  return () => void tokenListeners.delete(listener);
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return memoryToken;
  }
}

function storeToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the in-memory copy lasts until the page reloads.
  }
  for (const listener of tokenListeners) listener();
}

/** Every report, decided ones included, so the history covers the whole queue. */
async function fetchReports(token: string): Promise<ModerationReport[]> {
  const items: ModerationReport[] = [];
  let cursor: string | undefined;
  do {
    const { data, response } = await api.GET("/moderation/reports", {
      params: { query: { limit: PAGE_SIZE, cursor } },
      headers: bearer(token),
    });
    if (!data) throw new StatusError(response.status);
    items.push(...data.items);
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export function ModeratorScreen() {
  const token = useSyncExternalStore(subscribeToken, readToken, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const announce = useAnnounce();

  const signIn = useCallback((value: string) => {
    setNotice(null);
    storeToken(value);
  }, []);
  const signOut = useCallback(
    (message: string) => {
      setNotice(message);
      announce(message);
      storeToken(null);
      queryClient.removeQueries({ queryKey: ["moderation"] });
    },
    [announce, queryClient],
  );

  return token ? (
    <ModerationPanel token={token} onSignOut={signOut} />
  ) : (
    <SignInForm notice={notice} onSignedIn={signIn} />
  );
}

function SignInForm({ notice, onSignedIn }: { notice: string | null; onSignedIn: (token: string) => void }) {
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
  const ids = { input: useId(), hint: useId(), error: useId() };

  const fail = (message: string) => {
    setError(message);
    announce(message);
    inputRef.current?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = token.trim();
    if (!value) return fail(t.signIn.required);
    setChecking(true);
    try {
      const { response } = await api.GET("/moderation/reports", {
        params: { query: { status: "new", limit: 1 } },
        headers: bearer(value),
      });
      if (response.ok) {
        announce(t.signIn.signedIn);
        onSignedIn(value);
        return;
      }
      if (response.status === 429) return fail(t.signIn.lockedOut(retryMinutes(response.headers.get("retry-after"))));
      if (response.status === 401) return fail(t.signIn.invalid);
      fail(t.signIn.failed);
    } catch {
      fail(t.signIn.failed);
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
      {notice ? <p className="mb-3 text-body-sm font-semibold">{notice}</p> : null}
      <h2 className="flex items-center gap-2 font-display text-body font-bold">
        <LockKey weight="bold" className="size-5 shrink-0" aria-hidden />
        {t.signIn.heading}
      </h2>
      <p id={ids.hint} className="mt-2 text-body-sm text-foreground/85">
        {t.signIn.lead}
      </p>
      <label htmlFor={ids.input} className="mt-4 mb-2 block text-body-sm font-semibold">
        {t.signIn.token}
      </label>
      <input
        id={ids.input}
        ref={inputRef}
        name="password"
        type={show ? "text" : "password"}
        autoComplete="current-password"
        autoCapitalize="none"
        spellCheck={false}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${ids.error} ${ids.hint}` : ids.hint}
        className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-body outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-status-barrier"
      />
      {error ? (
        <p id={ids.error} className="mt-1.5 text-caption font-semibold text-status-barrier">
          {error}
        </p>
      ) : null}
      <label className="mt-3 flex min-h-6 items-center gap-2 text-body-sm">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-5 accent-primary" />
        {t.signIn.show}
      </label>
      <Button type="submit" className="mt-4 w-full" disabled={checking}>
        {checking ? t.signIn.checking : t.signIn.submit}
      </Button>
      <p className="mt-3 text-caption text-muted-foreground">{t.signIn.sessionNote}</p>
      {isMockApi ? <p className="mt-1 text-caption text-muted-foreground">{t.signIn.mockNote}</p> : null}
    </form>
  );
}

function ModerationPanel({ token, onSignOut }: { token: string; onSignOut: (message: string) => void }) {
  const queryClient = useQueryClient();
  const announce = useAnnounce();
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const noteId = useId();
  const noteHintId = useId();
  const queryKey = ["moderation", "reports", token];

  const query = useQuery({ queryKey, queryFn: () => fetchReports(token), retry: false });
  const expired = query.error instanceof StatusError && query.error.status === 401;

  useEffect(() => {
    if (expired) onSignOut(t.sessionExpired);
  }, [expired, onSignOut]);

  const reports = query.data ?? [];
  const open = reports.filter(isOpen);
  const current = open.find((r) => r.id === selected) ?? open[0];

  // Only the first load: after a decision its own message is the one to hear.
  const announcedLoad = useRef(false);
  useEffect(() => {
    if (!query.isSuccess || announcedLoad.current) return;
    announcedLoad.current = true;
    announce(t.loaded(query.data.filter(isOpen).length));
  }, [announce, query.isSuccess, query.data]);

  const decide = useMutation({
    mutationFn: async ({ report, decision }: { report: ModerationReport; decision: ModerationDecisionKind }) => {
      const { data, response } = await api.POST("/moderation/reports", {
        body: { reportId: report.id, decision, note: note.trim() || null },
        headers: bearer(token),
      });
      if (!data) throw new StatusError(response.status);
      return data;
    },
    onSuccess: (_report, { decision }) => {
      const message = t.decided[decision];
      toast(message);
      announce(message);
      setNote("");
      setSelected(null);
    },
    onError: (error) => {
      if (error instanceof StatusError && error.status === 401) return onSignOut(t.sessionExpired);
      const message = error instanceof StatusError && error.status === 409 ? t.alreadyDecided : t.decideFailed;
      toast.error(message);
      announce(message);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      queueHeading.current?.focus();
    },
  });

  if (query.isPending) {
    return (
      <p className="mt-4 text-body-sm text-muted-foreground" aria-busy="true">
        {t.loading}
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="mt-4 rounded-[20px] bg-status-barrier-bg p-4 text-body-sm text-status-barrier">
        <p>{t.loadFailed}</p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  const preview = current ? changePreview(current) : null;
  const history = moderationHistory(reports);

  return (
    <>
      <div className="mt-2 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => onSignOut(t.signedOut)}>
          <SignOut weight="bold" aria-hidden />
          {t.signOut}
        </Button>
      </div>

      <section className="mt-2">
        <h2
          ref={queueHeading}
          tabIndex={-1}
          className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase outline-none"
        >
          {t.queueCount(open.length)}
        </h2>
        {open.length ? (
          <ul className="space-y-2">
            {open.map((report) => {
              const item = changePreview(report);
              const active = report.id === current?.id;
              return (
                <li key={report.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => setSelected(report.id)}
                    className={cn(
                      "press flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-raised p-3 text-left ring-1 ring-border/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      active && "ring-2 ring-primary",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold">{report.placeName}</span>
                      <span className="block text-caption text-muted-foreground">
                        {item.attribute} → {item.after} · {formatDate(report.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-secondary-foreground">
                      {t.status[report.status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body-sm text-muted-foreground">{t.empty}</p>
        )}
      </section>

      {current && preview ? (
        <InfoSection title={t.preview}>
          <div className="rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
            <h3 className="text-body-sm font-semibold">
              {current.placeName} · {preview.attribute}
            </h3>
            <p className="text-caption text-muted-foreground">{t.reportedOn(formatDate(current.createdAt))}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted p-3">
                <dt className="text-caption text-muted-foreground">{t.before}</dt>
                <dd className={cn("mt-1 text-body-sm font-semibold", !preview.beforeKnown && "text-muted-foreground")}>
                  {preview.before}
                </dd>
              </div>
              <div className="rounded-2xl bg-card p-3 ring-2 ring-primary">
                <dt className="text-caption text-muted-foreground">{t.after}</dt>
                <dd className="mt-1 text-body-sm font-semibold">
                  {preview.after}
                  <ReliabilityBadge value="confirmed" className="mt-1 flex w-fit" />
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-caption text-muted-foreground">{t.afterSource}</p>
            {current.comment ? (
              <figure className="mt-3">
                <figcaption className="text-caption text-muted-foreground">{t.comment}</figcaption>
                <blockquote className="text-body-sm text-foreground/85">„{current.comment}”</blockquote>
              </figure>
            ) : null}
            {current.history.length ? (
              <ul className="mt-3 space-y-1 text-caption">
                {current.history.map((event, i) => (
                  <li key={i}>
                    <span className="font-semibold">{t.decision[event.decision]}</span> ·{" "}
                    {t.historyEntry(event.moderator, formatDateTime(event.decidedAt))}
                    {event.note ? <span className="block text-foreground/85">„{event.note}”</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <label htmlFor={noteId} className="mt-4 mb-2 block text-body-sm font-semibold">
              {t.note}
            </label>
            <textarea
              id={noteId}
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={noteHintId}
              className="min-h-16 w-full rounded-2xl border border-input bg-card px-4 py-3 text-body-sm outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <p id={noteHintId} className="mt-1.5 text-caption text-muted-foreground">
              {t.noteHint}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                className="col-span-2"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ report: current, decision: "accepted" })}
              >
                <CheckCircle weight="fill" aria-hidden />
                {t.approve}
              </Button>
              <Button
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ report: current, decision: "rejected" })}
              >
                <XCircle weight="bold" aria-hidden />
                {t.reject}
              </Button>
              <Button
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ report: current, decision: "needs_info" })}
              >
                <Question weight="bold" aria-hidden />
                {t.clarify}
              </Button>
            </div>
            {decide.isPending ? (
              <p className="mt-2 text-caption text-muted-foreground" aria-busy="true">
                {t.deciding}
              </p>
            ) : null}
          </div>
        </InfoSection>
      ) : null}

      <InfoSection title={t.history}>
        {history.length ? (
          <ul className="divide-y divide-border rounded-[20px] bg-surface-raised ring-1 ring-border/70">
            {history.map((entry) => (
              <li key={entry.key} className="flex items-start gap-3 px-4 py-3 text-caption">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {entry.placeName} · {entry.attribute} → {entry.value}
                  </span>
                  <span className="block text-muted-foreground">
                    {t.historyEntry(entry.moderator, formatDateTime(entry.decidedAt))}
                  </span>
                  {entry.note ? <span className="block text-foreground/85">„{entry.note}”</span> : null}
                </span>
                <span className="shrink-0 font-semibold">{t.decision[entry.decision]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-muted-foreground">{t.historyEmpty}</p>
        )}
      </InfoSection>
    </>
  );
}
