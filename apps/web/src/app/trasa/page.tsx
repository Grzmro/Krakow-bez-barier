import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { RouteScreen } from "./route-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.route.pageTitle} · ${m.common.app.name}` };
}

const param = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : undefined);

// From the start in `?z=` (`station`, a place id or `lat,lon`), else from the device position; with neither, no route is
// planned until a start is chosen. To Rynek Główny, or to the place in `?do=<id>` (the "Prowadź" button on its card).
export default async function RoutePage({ searchParams }: PageProps<"/trasa">) {
  const { do: to, z: from } = await searchParams;
  return <RouteScreen to={param(to)} from={param(from)} />;
}
