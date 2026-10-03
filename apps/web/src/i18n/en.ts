// English UI copy (US-8.6), one file per area mirroring `pl/`. Each file is typed against the Polish
// catalog, so a missing key or a changed signature is a compile error.
import type { Messages } from "./messages";
import { business } from "./en/business";
import { common } from "./en/common";
import { dev } from "./en/dev";
import { event } from "./en/event";
import { home } from "./en/home";
import { moderator } from "./en/moderator";
import { nearby } from "./en/nearby";
import { pages } from "./en/pages";
import { place } from "./en/place";
import { profile } from "./en/profile";
import { pwa } from "./en/pwa";
import { summary } from "./en/summary";

export const en: Messages = { common, home, place, profile, pages, moderator, nearby, business, event, dev, pwa, summary };
