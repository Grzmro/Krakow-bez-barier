import { ButtonLink } from "@/components/button-link";
import type { Messages } from "@/i18n/messages";
import { routes } from "@/lib/routes";

/** "No such place": the card's 404 page (server) and the card itself when the API says 404 (client). */
export function PlaceNotFound({ t }: { t: Messages["place"] }) {
  return (
    <div className="space-y-3 py-10">
      <h1 className="font-display text-h1 font-bold">{t.notFound}</h1>
      <p className="text-body text-muted-foreground">{t.notFoundHint}</p>
      <ButtonLink href={routes.home} variant="outline">
        {t.goHome}
      </ButtonLink>
    </div>
  );
}
