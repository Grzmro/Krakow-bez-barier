"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Flask, Question, SignOut, XCircle } from "@phosphor-icons/react";
import type { ModerationDecisionKind, ModerationReport, ModeratorSession } from "@krakow-bez-barier/contracts";
import { Button, cn, Field, Tabs, TabsContent, TabsList, Textarea, TabsTrigger, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { ReliabilityBadge } from "@/components/kbb";
import { bearer, DemoSignIn, ModeratorSignIn, StatusError, useModeratorSession } from "@/components/moderator/moderator-session";
import { InfoSection } from "@/components/layout/info-page";
import { useLocale, useMessages } from "@/i18n/client";
import { api, isMockApi } from "@/lib/api";
import { changePreview, formatDateTime, isOpen, moderationHistory, retryMinutes } from "@/lib/moderation";
import { formatDate } from "@/lib/place-facts";
import { routes } from "@/lib/routes";
import { OutagesTab, useModerationOutages } from "./outages-tab";
import { SourceOutagesTab } from "./source-outages-tab";

const NOTE_MAX = 500;

const PAGE_SIZE = 100;

const QUERY_KEY = ["moderation"] as const;

type Queue = { items: ModerationReport[]; moderator: ModeratorSession };

/** Every report, decided ones included, so the history covers the whole queue; and who is signed in. */
async function fetchReports(token: string): Promise<Queue> {
  const items: ModerationReport[] = [];
  let moderator: ModeratorSession | undefined;
  let cursor: string | undefined;
  do {
    const { data, response } = await api.GET("/moderation/reports", {
      params: { query: { limit: PAGE_SIZE, cursor } },
      headers: bearer(token),
    });
    if (!data) throw new StatusError(response.status, response.headers.get("retry-after"));
    items.push(...data.items);
    moderator = data.moderator;
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
  return { items, moderator: moderator! };
}

/** `demoRevertMinutes` (`demoSignInMinutes`): set when the server has a demo account, which then gets a one-click sign-in. */
export function ModeratorScreen({ demoRevertMinutes }: { demoRevertMinutes: number | null }) {
  const t = useMessages().moderator;
  const { token, notice, signIn, signOut } = useModeratorSession(QUERY_KEY);

  return token ? (
    <ModerationPanel token={token} onSignOut={signOut} />
  ) : (
    <>
      <DemoSignIn revertMinutes={demoRevertMinutes} signedInMessage={t.signIn.signedIn} onSignedIn={signIn} />
      <ModeratorSignIn notice={notice} signedInMessage={t.signIn.signedIn} onSignedIn={signIn} />
    </>
  );
}

function ModerationPanel({ token, onSignOut }: { token: string; onSignOut: (message: string) => void }) {
  const m = useMessages();
  const t = m.moderator;
  const locale = useLocale();
  const queryClient = useQueryClient();
  const announce = useAnnounce();
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const demoHeadingId = useId();
  // Sign-out removes every "moderation" query, so the token itself stays out of the cache key.
  const queryKey = ["moderation", "reports"];

  const query = useQuery({ queryKey, queryFn: () => fetchReports(token), retry: false });
  const outages = useModerationOutages(token);
  const expired = query.error instanceof StatusError && query.error.status === 401;

  useEffect(() => {
    if (expired) onSignOut(t.sessionExpired);
  }, [expired, onSignOut, t.sessionExpired]);

  const loadError =
    query.error instanceof StatusError && query.error.status === 429
      ? t.loadLockedOut(retryMinutes(query.error.retryAfter))
      : t.loadFailed;
  useEffect(() => {
    if (query.isError && !expired) announce(loadError);
  }, [announce, query.isError, expired, loadError]);

  const reports = query.data?.items ?? [];
  const session = query.data?.moderator;
  const open = reports.filter(isOpen);
  const current = open.find((r) => r.id === selected) ?? open[0];

  // The note belongs to one report: switching reports (by click or after a refresh) starts it empty.
  const [noteFor, setNoteFor] = useState(current?.id);
  if (noteFor !== current?.id) {
    setNoteFor(current?.id);
    setNote("");
  }

  // Only the first load: after a decision its own message is the one to hear.
  const announcedLoad = useRef(false);
  useEffect(() => {
    if (!query.isSuccess || announcedLoad.current) return;
    announcedLoad.current = true;
    announce(t.loaded(query.data.items.filter(isOpen).length));
  }, [announce, query.isSuccess, query.data, t]);

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
      const message = isMockApi
        ? t.decidedMock[decision]
        : session?.demo && session.revertsAfterMinutes
          ? t.decidedDemo[decision](session.revertsAfterMinutes)
          : t.decided[decision];
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
        <p>{loadError}</p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  const preview = current ? changePreview(current, locale) : null;
  const history = moderationHistory(reports, locale);

  return (
    <>
      <div className="mt-2 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => onSignOut(t.signedOut)}>
          <SignOut weight="bold" aria-hidden />
          {t.signOut}
        </Button>
      </div>

      {session?.demo ? (
        <aside
          aria-labelledby={demoHeadingId}
          className="mt-2 rounded-[20px] bg-status-unknown-bg p-4 text-body-sm ring-1 ring-border/70"
        >
          <h2 id={demoHeadingId} className="flex items-center gap-2 font-display text-body font-bold">
            <Flask weight="bold" className="size-5 shrink-0" aria-hidden />
            {t.demo.heading}
          </h2>
          <p className="mt-1 text-foreground/85">{t.demo.body(session.revertsAfterMinutes ?? 0)}</p>
        </aside>
      ) : null}

      <Tabs defaultValue="reports" className="mt-3">
        <TabsList aria-label={t.tabs.label}>
          <TabsTrigger value="reports">{t.tabs.reports(open.length)}</TabsTrigger>
          <TabsTrigger value="outages">{t.tabs.outages(outages.data?.length ?? null)}</TabsTrigger>
          <TabsTrigger value="source-outages">{t.tabs.sourceOutages}</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <section>
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
                  const item = changePreview(report, locale);
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
                            {item.attribute} → {item.after} · {formatDate(report.createdAt, locale)}
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
                <p className="text-caption text-muted-foreground">{t.reportedOn(formatDate(current.createdAt, locale))}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-muted p-3">
                    <dt className="text-caption text-muted-foreground">{t.before}</dt>
                    <dd className={cn("mt-1 text-body-sm font-semibold", !preview.beforeKnown && "text-muted-foreground")}>
                      {preview.before}
                      {preview.beforeSource ? (
                        <span className="mt-1 block text-caption font-normal text-muted-foreground">{preview.beforeSource}</span>
                      ) : null}
                      {preview.beforeConfirmations ? (
                        <span className="mt-0.5 block text-caption font-normal text-muted-foreground">{preview.beforeConfirmations}</span>
                      ) : null}
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
                <p className="mt-2 text-caption text-muted-foreground">{session?.demo ? t.afterSourceDemo : t.afterSource}</p>
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
                        {t.historyEntry(event.moderator, formatDateTime(event.decidedAt, locale))}
                        {event.note ? <span className="block text-foreground/85">„{event.note}”</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Field
                  label={t.note}
                  hint={t.noteHint}
                  counter={{ count: note.length, max: NOTE_MAX, label: m.common.form.characters(note.length, NOTE_MAX) }}
                  className="mt-4"
                >
                  <Textarea value={note} maxLength={NOTE_MAX} rows={2} onChange={(e) => setNote(e.target.value)} />
                </Field>

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
                        {entry.summary}
                      </span>
                      <span className="block text-muted-foreground">
                        {t.historyEntry(entry.moderator, formatDateTime(entry.decidedAt, locale))}
                      </span>
                      {entry.note ? <span className="block text-foreground/85">„{entry.note}”</span> : null}
                      {entry.decision === "accepted" ? (
                        <Link
                          href={routes.place(entry.placeId)}
                          aria-label={t.showOnCardLabel(entry.placeName)}
                          className="mt-1 inline-flex min-h-6 items-center font-semibold text-primary underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {t.showOnCard}
                        </Link>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold">{t.decision[entry.decision]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-muted-foreground">{t.historyEmpty}</p>
            )}
          </InfoSection>
        </TabsContent>
        <TabsContent value="outages">
          <OutagesTab token={token} query={outages} session={session} onSignOut={onSignOut} />
        </TabsContent>
        <TabsContent value="source-outages">
          <SourceOutagesTab token={token} onSignOut={onSignOut} />
        </TabsContent>
      </Tabs>
    </>
  );
}
