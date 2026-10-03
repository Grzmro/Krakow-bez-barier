// All Polish UI copy, split per area so parallel work doesn't conflict. Add strings to the area
// file (`pl/<area>.ts`); only touch this index when adding a new area.
import { common } from "./pl/common";
import { dev } from "./pl/dev";
import { home } from "./pl/home";
import { moderator } from "./pl/moderator";
import { nearby } from "./pl/nearby";
import { pages } from "./pl/pages";
import { place } from "./pl/place";
import { profile } from "./pl/profile";

export const pl = { common, home, place, profile, pages, moderator, nearby, dev } as const;
