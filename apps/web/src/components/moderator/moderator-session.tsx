"use client";

import { useCallback, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flask, LockKey } from "@phosphor-icons/react";
import { Button, Checkbox, Field, Input, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { api, isMockApi } from "@/lib/api";
import { retryMinutes } from "@/lib/moderation";

// One moderator session for every staff page (/moderator, /miasto): signing in on one signs in on the other.
const TOKEN_KEY = "kbb.moderatorToken";

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** A failed API call with its HTTP status (and `retry-after` on a lockout). */
export class StatusError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
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

/**
 * The signed-in moderator's token, and sign-in / sign-out. Signing out announces `message`, keeps it as the notice
 * for the sign-in form and drops every query under `queryKey` (a module constant; keys never hold the token itself).
 */
export function useModeratorSession(queryKey: readonly string[]) {
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
      queryClient.removeQueries({ queryKey });
    },
    [announce, queryClient, queryKey],
  );
  return { token, notice, signIn, signOut };
}

/** Moderator token form: pasted token, checked against the API, lockout and errors explained in text. */
export function ModeratorSignIn({
  notice,
  signedInMessage,
  onSignedIn,
}: {
  notice: string | null;
  /** Announced on success: says what the page shows now. */
  signedInMessage: string;
  onSignedIn: (token: string) => void;
}) {
  const t = useMessages().moderator;
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
  const ids = { hint: useId() };

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
        announce(signedInMessage);
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
      <Field label={t.signIn.token} error={error} className="mt-4">
        <Input
          ref={inputRef}
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          aria-describedby={ids.hint}
        />
      </Field>
      <Checkbox label={t.signIn.show} checked={show} onCheckedChange={setShow} className="mt-1" />
      <Button type="submit" className="mt-3 w-full" disabled={checking}>
        {checking ? t.signIn.checking : t.signIn.submit}
      </Button>
      <p className="mt-3 text-caption text-muted-foreground">{t.signIn.sessionNote}</p>
      {isMockApi ? <p className="mt-1 text-caption text-muted-foreground">{t.signIn.mockNote}</p> : null}
    </form>
  );
}

/**
 * One-click sign-in to the demo account for the jury: the server issues a demo-only session, so no token is pasted
 * and no real one reaches the browser. Without a demo account on the server (`revertMinutes` null) it says so
 * instead of offering a button that can't work.
 */
export function DemoSignIn({
  revertMinutes,
  signedInMessage,
  onSignedIn,
}: {
  /** After how many minutes the demo account's decisions are undone; `null` when the server has no demo account. */
  revertMinutes: number | null;
  signedInMessage: string;
  onSignedIn: (token: string) => void;
}) {
  const t = useMessages().moderator.demoEntry;
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();
  const ids = { heading: useId(), lead: useId(), error: useId() };

  const enter = async () => {
    setEntering(true);
    setError(null);
    try {
      const { data, response } = await api.POST("/moderation/demo-session");
      if (data) {
        announce(signedInMessage);
        onSignedIn(data.token);
        return;
      }
      const message = response.status === 404 ? t.unavailable : t.failed;
      setError(message);
      announce(message);
    } catch {
      setError(t.failed);
      announce(t.failed);
    } finally {
      setEntering(false);
    }
  };

  if (revertMinutes === null) return <p className="mt-4 text-body-sm text-muted-foreground">{t.unavailable}</p>;

  return (
    <section aria-labelledby={ids.heading} className="mt-4 rounded-[20px] bg-status-unknown-bg p-4 ring-1 ring-border/70">
      <h2 id={ids.heading} className="flex items-center gap-2 font-display text-body font-bold">
        <Flask weight="bold" className="size-5 shrink-0" aria-hidden />
        {t.heading}
      </h2>
      <p id={ids.lead} className="mt-2 text-body-sm text-foreground/85">
        {t.lead(revertMinutes)}
      </p>
      <Button
        type="button"
        className="mt-4 h-auto min-h-12 w-full py-3 whitespace-normal"
        disabled={entering}
        aria-describedby={error ? `${ids.error} ${ids.lead}` : ids.lead}
        onClick={enter}
      >
        {entering ? t.entering : t.button}
      </Button>
      {error ? (
        <p id={ids.error} className="mt-1.5 text-caption font-semibold text-status-barrier">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-caption text-muted-foreground">{t.or}</p>
    </section>
  );
}
