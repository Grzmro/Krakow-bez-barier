import type { Metadata } from "next";
import { pl } from "@/i18n/pl";
import { RouteScreen } from "./route-screen";

export const metadata: Metadata = {
  title: `${pl.route.pageTitle} · ${pl.common.app.name}`,
};

// From Dworzec Główny to Rynek Główny, or to the place in `?do=<id>` (the "Prowadź" button on its card).
export default async function RoutePage({ searchParams }: PageProps<"/trasa">) {
  const { do: to } = await searchParams;
  return <RouteScreen to={typeof to === "string" && to ? to : undefined} />;
}
