"use client";

import { Info } from "@phosphor-icons/react";
import { useMessages } from "@/i18n/client";
import { useProfile } from "@/lib/profile/use-profile";

/** The landing of a shared link: the result follows the recipient's own profile (a clear default when there is none). */
export function SharedNotice({ kind, className }: { kind: "place" | "route"; className?: string }) {
  const m = useMessages();
  const t = m.share.notice;
  const { settings } = useProfile();
  const profile = settings.profile;

  return (
    <section aria-labelledby="shared-notice-title" className={`flex gap-3 rounded-[20px] bg-primary-container p-4 ${className ?? ""}`}>
      <Info weight="fill" className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <h2 id="shared-notice-title" className="text-body font-semibold">
          {t.title}
        </h2>
        <p className="mt-1 text-body-sm">{t[kind]}</p>
        <p className="mt-1 text-body-sm font-semibold">{profile ? t.withProfile(m.profile.name[profile]) : t.noProfile}</p>
      </div>
    </section>
  );
}
