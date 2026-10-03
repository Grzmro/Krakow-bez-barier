"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce | null>(null);

/**
 * One polite live region for the whole app. Screens call `useAnnounce()("Znaleziono 12 miejsc")`
 * after async results or filter changes instead of rendering their own aria-live elements.
 */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState({ text: "", seq: 0 });
  const announce = useCallback<Announce>((text) => {
    setMessage((prev) => ({ text, seq: prev.seq + 1 }));
  }, []);
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {/* The key re-mounts the text so repeating the same message is announced again. */}
        <span key={message.seq}>{message.text}</span>
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext);
  if (!announce) throw new Error("useAnnounce must be used inside <LiveRegionProvider>");
  return announce;
}
