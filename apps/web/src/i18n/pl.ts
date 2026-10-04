// All Polish UI copy, split per area so parallel work doesn't conflict. Add strings to the area
// file (`pl/<area>.ts`); only touch this index when adding a new area.
import { business } from "./pl/business";
import { city } from "./pl/city";
import { common } from "./pl/common";
import { dev } from "./pl/dev";
import { event } from "./pl/event";
import { home } from "./pl/home";
import { moderator } from "./pl/moderator";
import { nearby } from "./pl/nearby";
import { pages } from "./pl/pages";
import { place } from "./pl/place";
import { plan } from "./pl/plan";
import { profile } from "./pl/profile";
import { pwa } from "./pl/pwa";
import { quality } from "./pl/quality";
import { route } from "./pl/route";
import { share } from "./pl/share";
import { summary } from "./pl/summary";
import { transit } from "./pl/transit";

export const pl = { common, home, place, profile, pages, moderator, nearby, business, event, dev, pwa, summary, route, city, transit, quality, share, plan } as const;
