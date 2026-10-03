import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { RouteScreen } from "./route-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.route.pageTitle} · ${m.common.app.name}` };
}

// From Dworzec Główny to Rynek Główny, or to the place in `?do=<id>` (the "Prowadź" button on its card).
export default async function RoutePage({ searchParams }: PageProps<"/trasa">) {
  const { do: to } = await searchParams;
  return <RouteScreen to={typeof to === "string" && to ? to : undefined} />;
}
