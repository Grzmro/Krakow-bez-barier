import type { Metadata } from "next";
import { ProfilePlaces } from "@/components/profile/profile-places";
import { pl } from "@/i18n/pl";

export const metadata: Metadata = { title: `${pl.profile.page.title} · ${pl.common.app.name}` };

// TODO(KBB-41): the profile switch and verdicts move onto the home screen; this page goes away.
export default function ProfilePage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-10">
      <h1 className="font-heading text-display font-extrabold text-foreground">{pl.profile.page.title}</h1>
      <p className="text-body text-muted-foreground">{pl.profile.page.lead}</p>
      <ProfilePlaces />
    </main>
  );
}
