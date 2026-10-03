# Data sources register

The register of every data source Kraków bez barier reads or depends on (challenge R2, R3, R5).
Values below were checked on **2026-10-03**. Anything not verified is labelled **to confirm**; we
never state a licence we have not seen.

Each ingest adapter (`apps/ingest/src/adapters/<source-id>.ts`, see `.claude/rules/ingest.md`)
registers the same metadata in code: name, URL, licence and terms, attribution text, update
frequency, base reliability. This file is the human-readable copy; if they disagree, fix both.
**A source without a confirmed licence is not ingested** (rule in `.claude/rules/ingest.md`) —
see the status column.

## Summary

| Id | Source | Used for | Licence | Licence status | Ingested |
|---|---|---|---|---|---|
| `osm` | OpenStreetMap via Overpass | places, `wheelchair=*` and related tags | ODbL 1.0 | Confirmed | yes |
| `bip-mk` | BIP MK "Dostępność architektoniczna" pages of city units (cultural institutions first) | lift, ramp, accessible toilet, changing table, disabled parking, level entrance, door width — read from the text | GMK rules for reuse of public-sector information, pt III (commercial use allowed) | Confirmed | yes |
| `bip-malopolska` | Accessibility declarations ("Dostępność architektoniczna" part) of public bodies in the Małopolska regional BIP: offices, museums, libraries, the state archive | lift, ramp, accessible toilet, disabled parking, level entrance — read from the text | Open data act: BIP information reused without a request; per publisher, only where the act applies and no other terms are set | Confirmed for 7 publishers; theatres/opera **to confirm** (act does not apply) and not fetched | yes |
| `krakow-pl-toilets` | krakow.pl "Kraków bez barier": "Toalety ogólnodostępne" (list of 65 adapted toilets, updated 2025-09-15) | accessible toilet, overall access, lift/platform, ramp, level entrance — paired with OSM toilets | krakow.pl terms: non-commercial use allowed, commercial use needs the city's consent | **Non-commercial, to confirm for commercial use** (shown as such) | yes (switch off with `WITHHELD_SOURCES`) |
| `msip-toilets` | MSIP "Toalety publiczne" (`WT_WC_2023`) | city public toilets, accessibility fields | Not stated in the service; the layer is **not** in MSIP's OPEN DATA ("Pobieranie") folder | **Not open data — withheld** | no; facts already in a database are not served (KBB-133) |
| `zdmk-parking-ozn` | ZDMK "Miejsca postojowe OZN" (ArcGIS Online) | marked parking spaces for disabled drivers | No licence in the ArcGIS item | **To confirm** | only after confirmation |
| `ztp-stops` | ZTP "Przystanki Komunikacji Miejskiej w Krakowie" (ArcGIS Online) | stop inventory: benches, platform surface | No licence in the ArcGIS item | **To confirm** | only after confirmation |
| `msip-koh` | MSIP "Obiekty hotelarskie KOH" (`WT_OBIEKTY_HOTELOWE_KOH`) | hotel names/categories/addresses, no accessibility fields | Not stated; derived from the national register of hotel facilities | **To confirm** | only after confirmation |
| `ztp-gtfs-rt` | ZTP Kraków GTFS + GTFS-Realtime | nearest stops, next departures, vehicle wheelchair flag | None published | **To confirm** | no (on demand, server-side; off in production until confirmed) |
| (runtime) | openrouteservice | routing, not stored | Service terms (HeiGIT) | Partly confirmed | no (on demand, server-side) |
| (runtime) | OpenFreeMap tiles | base map | MIT (project); map data OSM/ODbL | Confirmed | no (browser loads tiles) |

## Accessibility-data sources

### `osm` — OpenStreetMap via Overpass

| | |
|---|---|
| Origin | OpenStreetMap community, read through the Overpass API |
| Endpoint | Overpass API instance configured in the city config (not hard-coded). Fallback when Overpass fails: the Geofabrik regional extract (`sourceConfig.osm.extractUrl`, e.g. `europe/poland/malopolskie-latest.osm.pbf`), cut to the city box and the same category tags |
| What we read | `tourism` (museum, hotel, hostel, guest_house, gallery, attraction), `amenity` (restaurant, cafe, toilets, pharmacy, theatre, cinema, library); tags `wheelchair`, `toilets:wheelchair`, `wheelchair:description`, `changing_table`, `elevator`, `level` / `building:levels` (→ `levels`; `building:levels` only for venues that fill their building), `check_date`, ... Beyond venues: `amenity=bench` (→ `bench`), `parking_space=disabled` and `amenity=parking` with `capacity:disabled` (→ `disabled_parking`), `highway=elevator` (→ `lift`), `highway=steps` (→ `step_count`, `ramp=no` / `ramp:wheelchair`), `barrier=kerb` / `kerb=*` (→ `kerb_height_cm`, only `flush` or a measured `kerb:height`) |
| Licence | Open Database Licence (ODbL) 1.0 |
| Attribution | "© OpenStreetMap contributors" (shown wherever OSM-derived facts or the map are shown) |
| Freshness | Per object. `check_date` is stored as `observedAt` when present, otherwise the fact has no observation date and is shown as such |
| Update frequency | Ingest re-reads on the GitHub Actions cron (configured in the workflow) |
| Verification | Provenance `osm:<type>/<id>@v<version>`; read from the extract: `osm:<type>/<id>@v<version>;geofabrik-<extract date>`, and the source status says „OSM (Geofabrik, ekstrakt z <date>)” (date from the PBF header's replication timestamp, else the download's `Last-Modified`). Reliability is a community claim, lower than a declared or surveyed fact; a recent `check_date` raises it, a missing one lowers it. Conflicts with other sources are shown side by side, never merged |
| When unavailable | The run is logged as `failed` in `ingestion_run`, previous facts are kept and marked stale ("Źródło niedostępne, dane z <date>"). Nothing is deleted |
| Coverage caveat | In the demo bbox only 99 of 649 objects (15%) have `wheelchair=*`; steps, door width and ramp tags are almost absent. Details: `docs/demo-data.md` |
| Usage rules | Respect Overpass rate limits, send a descriptive `User-Agent`, cache downloads in development. The Geofabrik extract is cached in `INGEST_CACHE_DIR` and revalidated at most daily (`If-Modified-Since`) |

Share-alike: our derived database of OSM facts is a derivative database under ODbL — see
`docs/deployment.md` (Licences).

### `bip-mk` — BIP MK "Dostępność architektoniczna"

| | |
|---|---|
| Origin | Biuletyn Informacji Publicznej Miasta Krakowa: every city unit (MJO) has a "Dostępność architektoniczna" page, linked from its "Deklaracja dostępności" (`#a11y-architektura-url`). Free text written by the unit about its own building(s) |
| Endpoint | `https://www.bip.krakow.pl/?mmi=<id>&metka=1` per page (`metka=1` adds the creation / publication / update dates). The pages and the places on them are city config (`apps/ingest/src/cities/data/krakow-bip-pages.ts`): 19 pages, 23 places of cultural institutions. A page about several buildings lists one place per building with the sections (`from`/`to` headings) that describe it |
| What we read | Sentence by sentence (`declaration-extract.ts`, shared with `bip-malopolska`): `lift`, `ramp` (only to the entrance or grounds), `toilet_accessible`, `changing_table`, `disabled_parking`, `entrance_level`, `door_width_cm` (one width in cm). Plans, contact lines, headings, evacuation and transit sentences are ignored; an attribute stated both ways in one place's text is skipped (`ambiguous` in the run log), never guessed |
| Licence | "Zasady udostępniania informacji publicznych … w celu ich ponownego wykorzystywania" (https://www.bip.krakow.pl/?dok_id=48482), pt III: free use for commercial and non-commercial purposes, including changes. Conditions (pt II): name the source and the time the information was created and obtained, say it was processed, and include the GMK liability disclaimer — all in the source's attribution on `/o-danych` and in each fact (page link, page update date, fetch date) |
| Freshness | `observedAt` = the page's "Data aktualizacji". Pages not updated for 12 months are shown as possibly outdated, like any fact |
| Update frequency | Daily with the ingest cron; pages are fetched one after another, 1 s apart, with the ingest `User-Agent` |
| Verification | Reliability `extracted`. Each fact carries the sentence it was read from as `evidence.comment` („…”) and the page as `evidence.url`; the place card shows both. Record ref `bip-mk:page/<mmi>/<place>@<update date>`. Facts attach to the OSM place named in the config (`osmRef` → `sameAs`); without it in the database a new place is created at the OSM object's coordinates (no paid geocoder) |
| When unavailable | A page that fails is logged and left out, its places keep their facts; the run fails only when no page could be read |
| Coverage caveat | No unit states a door width for its entrance, so no place meets the wheelchair preset on BIP data alone; Muzeum Krakowa (a PDF) and Teatr Variete (one line) have no usable text |

### `bip-malopolska` — accessibility declarations in the Małopolska regional BIP

| | |
|---|---|
| Origin | Regionalny System Biuletynów Informacji Publicznej w Małopolsce (bip.malopolska.pl, run by the Marshal's Office): one BIP for ~70 public bodies in Kraków — the voivode's office, inspectorates, regional museums and libraries, the state archive, theatres, universities. Each body's accessibility declaration follows the official template; its "Dostępność architektoniczna" part (`#a11y-architektura`) is free text written by the body about its own buildings |
| Endpoint | `https://bip.malopolska.pl/api/contexts/<unit>/accessibility-declaration` (JSON: `content` = the declaration HTML, `modifyDate`); the API root is city config (`sourceConfig["bip-malopolska"].endpoint`). The human page `https://bip.malopolska.pl/<unit>,e,deklaracja.html` is the configured URL and every fact's link. Pages, places and reuse terms: `apps/ingest/src/cities/data/krakow-bip-malopolska.ts` |
| What we read | The architecture part up to "Dostępność komunikacyjno-informacyjna", split into sentences; a building's `sections` are matched per sentence (editors put two buildings in one paragraph). Same rules as `bip-mk` (`declaration-extract.ts`): `lift`, `ramp`, `toilet_accessible`, `changing_table`, `disabled_parking`, `entrance_level`, `door_width_cm`; an attribute stated both ways is skipped (`ambiguous`) |
| Licence | Ustawa z 11 sierpnia 2021 r. o otwartych danych i ponownym wykorzystywaniu informacji sektora publicznego: information in a body's BIP is reused without a request; without other terms the user names the source and the time the information was created and obtained, and says it was processed (all in our provenance). **Per publisher**, recorded as `license` on each configured page and checked in its BIP on 2026-10-04: MUW, Kuratorium Oświaty and Archiwum Narodowe (request only for information outside the BIP / archive resource without conditions), Muzeum Etnograficzne (BIP information for commercial and non-commercial use), Muzeum Archeologiczne, Wojewódzka Biblioteka Publiczna and Pedagogiczna Biblioteka Wojewódzka (no other terms in their BIP) — **confirmed**. Opera Krakowska and Teatr im. Słowackiego — **to confirm, not fetched**: the act does not apply to cultural institutions other than museums and libraries, nor to universities (art. 4), and their BIP sets no terms. The same holds for Filharmonia, Cricoteka, MIK, AGH, PK, ASP, UR (not configured) |
| Not here | Declarations on institutions' own websites (mnk.pl, stary.pl, mck.krakow.pl, wawel.krakow.pl, opera.krakow.pl) are not BIP: their reuse terms are **to confirm**, so they are not read. Wawel's declaration in this BIP has only headings; Muzeum Narodowe, Muzeum Lotnictwa and Manggha have none |
| Attribution | "Źródło: Regionalny System Biuletynów Informacji Publicznej w Małopolsce (bip.malopolska.pl), deklaracje dostępności podmiotów …"; "Informacja przetworzona: fakty odczytane automatycznie z tekstu deklaracji, z cytatem" |
| Freshness | `observedAt` = the declaration's `modifyDate` (any change of the declaration, not only its architecture part) |
| Verification | Source kind `venue_owner` (the body's own statement, „Zarządca obiektu”), reliability `extracted`, below an on-site check. Each fact quotes its sentence (`evidence.comment`) and links the declaration (`evidence.url`). Record ref `bip-malopolska:page/<unit>/<place>@<modify date>`. Facts attach to the OSM place in `osmRef` (museums); offices and libraries are not OSM venues in our categories, so they become places of their own at the OSM building's coordinates |
| Coverage | 7 publishers, 11 buildings, 32 facts (run of 2026-10-04) |
| When unavailable | A declaration that fails is logged and left out, its places keep their facts; the run fails only when none could be read. Requests go one after another, 1 s apart |

### `krakow-pl-toilets` — krakow.pl "Toalety ogólnodostępne"

| | |
|---|---|
| Origin | Urząd Miasta Krakowa, krakow.pl service "Kraków bez barier" (publisher "Bez barier"), page https://www.krakow.pl/bezbarier/turystyka_sport_kultura/2780,artykul,toalety-ogolnodostepne.html: "Ogólnodostępne toalety dostosowane dla osób z niepełnosprawnościami" |
| What we read | 65 numbered entries: place name, type (obsługowa / samoobsługowa), opening hours, facility for disabled people ("platforma", "winda", "pochylnia", "wjazd z poziomu 0", "schodołaz"); page update date from `<time title="Data aktualizacji">` (2025-09-15) |
| Licence | **Non-commercial use, to confirm for commercial use.** krakow.pl legal information (https://www.krakow.pl/start/3307,artykul,informacje_prawne.html): content may not be reproduced without the owner's written consent, "z wyłączeniem wykorzystania dla celów niekomercyjnych". The hackathon prototype is non-commercial; a commercial service needs consent or a reuse request under the GMK rules (pt IV). The source card and `/o-danych` show this wording |
| Attribution | "Źródło: Urząd Miasta Krakowa, serwis krakow.pl „Kraków bez barier”, strona „Toalety ogólnodostępne”"; processed: entries paired with OSM toilets |
| Freshness | `observedAt` = the page's update date (2025-09-15). That is over 12 months before the demo, so the card shows these facts as "Może być nieaktualne" and a fresh OSM fact decides; when the city updates the page, disagreements become "Sprzeczne" |
| Matching | The page has no coordinates. Pairing entry → OSM toilet is configuration (`apps/ingest/src/cities/data/krakow-pl-toilets.ts`), made once: the entry's place or street geocoded with OSM Nominatim (free, ~65 requests at 1/s), nearest OSM toilet within ~150 m, each pair checked. 24 of 65 entries are paired; ambiguous ones (two OSM toilets nearby, e.g. Bulwar Czerwieński) and ones without an OSM toilet are left out. A configured heading missing from a later page is logged and not loaded |
| Adapter | `apps/ingest/src/adapters/krakow-pl-toilets.ts`, tested on `apps/ingest/test/fixtures/krakow-pl-toilets.html`. On the list → `toilet_accessible = true`, `wheelchair_overall = yes` ("schodołaz" only → `limited`); "platforma" / "winda" → `lift`, "pochylnia" → `ramp`, "wjazd z poziomu 0" → `entrance_level`; other facilities skipped and counted. Evidence: the entry's words and the page link. Record ref `krakow-pl-toilets:<id>@<update date>`. Reliability `confirmed` (city publication) |
| Switch off | Remove `krakow-pl-toilets` from the city's `sources` (ingest) and set `WITHHELD_SOURCES=krakow-pl-toilets` on the web server (the API stops serving its facts, the source card says so) |

### `msip-toilets` — MSIP "Toalety publiczne"

**Withheld (KBB-133).** The layer is not in MSIP's OPEN DATA ("Pobieranie") folder, so it has no basis for reuse.
The API never serves facts of a source whose licence is "to be confirmed" (`isWithheld` in
`apps/web/src/server/sources.ts`), so facts loaded by an older seed stay in the database but reach no screen,
route or statistic; `/o-danych` lists the source with the reason. The seed no longer writes MSIP facts.

| | |
|---|---|
| Origin | Miasto Kraków, Miejski System Informacji Przestrzennej (MSIP), Obserwatorium portal. Service description: "Toalety publiczne w Krakowie na podstawie danych z ISDP". Which unit maintains it: **to confirm** (the service only says "ISDP"). Toilets are operated by ZIW Kraków |
| Endpoint | `https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_WC_2023/MapServer/0` (ArcGIS REST, `query` with `f=json`; pagination unsupported — one query) |
| What we read | 50 toilets; `nplnsprw` (access for disabled people), `rodz_npl` (type of modification), `przewijak` (changing table), `godziny`, `status` |
| Licence | **To confirm.** The ArcGIS service metadata has an empty `copyrightText` and no licence. The MSIP regulation ("Regulamin Miejskiego Systemu Informacji Przestrzennej (MSIP) i zasady ponownego wykorzystania informacji sektora publicznego", https://msip.krakow.pl/?dok_id=228972, updated 2025-10-29) says the download service offers only data classified "OPEN DATA - Pobieralne"; other data is informational, for browsing. It also forbids commercial redistribution of content in IT systems and requires citing the source. We have **not** verified that this layer is classified OPEN DATA |
| Attribution (per regulation, if reuse is allowed) | "Gmina Miejska Kraków, Portal MSIP Obserwatorium (https://msip.krakow.pl)" |
| Freshness | Dataset year 2023 (layer name); the fetch date is stored as `fetchedAt`. No per-record date, so the UI shows "dataset 2023" |
| Update frequency | Unknown, no published schedule. Treated as static; re-read on the cron |
| Verification | No ID or OSM ref; matched to OSM toilets by distance (all 9 in the demo bbox are within 13 m). Reliability: official city dataset, but old |
| When unavailable | Same as above. The older host `msip3.um.krakow.pl` returns 404 (2026-10-03); the live demo uses it to simulate an outage (KBB-29) |
| Adapter | `apps/ingest/src/adapters/msip-toilets.ts`, mapper tested on `apps/ingest/test/fixtures/msip-toilets-sample.json` (the 9 toilets in the demo bbox, recorded 2026-10-03). `nplnsprw` "tak", "tak, oddzielnie", "tak, pomiędzy toaletą damską a męską" → `wheelchair_overall = yes`, "tak, po stronie damskiej" (accessible cubicle on the women's side only) → `limited`, "nie" → `no`, anything else skipped; `rodz_npl` "pochylnia" → `ramp`, "winda" / "platforma" → `lift`, "wjazd z poziomu 0" → `entrance_level`, other values (e.g. "schodołaz") skipped; closed toilets (`status = nie`) skipped; `przewijak` "Tak" / "brak" → `changing_table`. The original wording is kept as the evidence comment. Record ref `msip-toilets:WT_WC_2023/<ESRI_OID>`. `licenseConfirmed: false`, so the CLI and the runner refuse to load it |

### `msip-koh` — MSIP "Obiekty hotelarskie KOH"

| | |
|---|---|
| Origin | Miasto Kraków, Wydział Turystyki (keywords in service metadata: UMK, Wydział Turystyki, CWOH). Per the service description the data comes from the national "Centralny Wykaz Obiektów Hotelarskich" (published by the minister for tourism from data passed by voivodeship marshals) |
| Endpoint | `https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_OBIEKTY_HOTELOWE_KOH/MapServer/0` |
| What we read | 204 facilities: name, category, street, address. **No accessibility fields**; used only to enrich hotel places (name/category) |
| Licence | **To confirm.** Same position as `msip-toilets`: no licence in the service metadata; MSIP regulation limits reuse to OPEN DATA-classified data (classification not verified). The upstream register's own terms are also **to confirm** |
| Attribution | As for `msip-toilets`, plus the upstream register, if reuse is confirmed |
| Freshness | Import date 2023-06-30 |
| Update frequency | Unknown; treated as static |
| Verification | Matched to OSM hotels by name/distance. Carries no accessibility claim, so it never makes a place "accessible" |
| When unavailable | As for `osm`: last data kept, marked stale |

### `zdmk-parking-ozn` — ZDMK "Miejsca postojowe OZN"

| | |
|---|---|
| Origin | ArcGIS Online organisation of Gmina Miejska Kraków (`gmk-2`), item "Miejsca postojowe OZN" (https://gmk-2.maps.arcgis.com/home/item.html?id=f0fc14687d51400aaaef0ef2c4900257), published with the web map "Mapa miejskich miejsc postojowych dla pojazdów osób z niepełnosprawnościami"; item description: "Inwentaryzacja Survey123". The owner account also publishes "Mapa ZDMK"; that ZDMK maintains it is **to confirm** |
| Endpoint | `https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services/Miejsca_postojowe_OZN/FeatureServer/0` (public, no key; 2,037 points, 297 in the demo bbox on 2026-10-03) |
| What we read | `ID_MIEJSCA`, `punkt_adresowy` (address), point geometry |
| Licence | **To confirm.** The item has empty `licenseInfo` and `accessInformation` |
| Freshness | No per-record date; layer `dataLastEditDate` 2026-09 |
| Adapter | `apps/ingest/src/adapters/zdmk-parking-ozn.ts`: one place per space (category `parking`, hidden from the default places list) with `disabled_parking = true`; ref `zdmk-parking-ozn:space/<ID_MIEJSCA>`. Fixture `zdmk-parking-ozn-sample.json`. Not matched to OSM (OSM places we ingest carry no parking spaces) |
| When unavailable | As for `osm`: last data kept, marked stale |

### `ztp-stops` — ZTP "Przystanki Komunikacji Miejskiej w Krakowie"

| | |
|---|---|
| Origin | ArcGIS Online organisation of Gmina Miejska Kraków (`gmk-2`), item "Przystanki Komunikacji Miejskiej w Krakowie" (https://gmk-2.maps.arcgis.com/home/item.html?id=73cfc1778d0d4305a643ef0d2cb13e1f); item snippet: "Baza przystanków w Krakowie oraz aglomeracji, prowadzona przez Zarząd Transportu Publicznego w Krakowie" |
| Endpoint | `https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services/Przystanki_Komunikacji_Miejskiej_w_Krakowie/FeatureServer/0` (public, no key; 3,756 platforms, 88 in the demo bbox) |
| What we read | `Nazwa_przystanku_nr`, `kod_busman`, `Grupa`, `Nawierzchnia_peronu`, `Krawężnik_peronowy`, `Wiata_liczba`, bench counts, `EditDate` |
| Licence | **To confirm.** The item has empty `licenseInfo` and `accessInformation` |
| Freshness | Per record: `EditDate` is stored as `observedAt` |
| Adapter | `apps/ingest/src/adapters/ztp-stops.ts`: one place per platform (category `transit_stop`, hidden from the default places list). Benches outside the shelter > 0 → `bench = true`; no shelter and no seats → `bench = false`; a shelter without other seats → no fact (the inventory does not count shelter benches). Platform surface → `surface` (`asfalt` asphalt, `beton` concrete, `płyty_chodnikowe` paving_stones; `kostka` is skipped, since it does not say concrete blocks or stone setts). `Krawężnik_peronowy` (tak / nie / kassel-kerb) has no height in the data → skipped and counted. Suspended stops (`Grupa = KMK_zawieszony`) and platforms past their `validUntil` are skipped. Ref `ztp-stops:stop/<kod_busman>` (GlobalID when missing). Fixture `ztp-stops-sample.json` |
| When unavailable | As for `osm`: last data kept, marked stale |

**Decision rule until the city licences are confirmed:** the city adapters (`msip-toilets`,
`zdmk-parking-ozn`, `ztp-stops`; `msip-koh` has no adapter yet) are written and tested on recorded
fixtures, carry `licenseConfirmed: false`, and the CLI and runner refuse to ingest them (the daily
cron skips them with a warning). The submission names these layers as "licence to confirm". Confirmation path: ask the MSIP
Administrator (the regulation names this role) whether `WT_WC_2023` and `WT_OBIEKTY_HOTELOWE_KOH`
are classified OPEN DATA and under which licence, and check https://otwartedane.krakow.pl for a
matching dataset record. For the ZDMK and ZTP layers, ask ZDMK and ZTP (the item owners in the
city's ArcGIS Online organisation) for the licence. We could not complete any of this from here.

## Runtime dependencies (not ingested)

### openrouteservice — routing

| | |
|---|---|
| Origin | HeiGIT (Heidelberg Institute for Geoinformation Technology), data from OpenStreetMap |
| Endpoint | openrouteservice API, `wheelchair` profile; called only from the server (key in `ORS_API_KEY`), behind `RoutingProvider` |
| Licence / terms | Service terms at https://openrouteservice.org/terms-of-service/ (redirects to account.heigit.org; the page is a script-rendered app we could not read in full). From search results, not read at source, **to confirm**: free API use requires the attribution "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors"; the free plan has daily and per-minute quotas (directions reported as 2,000/day, 40/min); commercial use needs a paid plan or contact with HeiGIT. Route geometry derives from OSM |
| Freshness | Depends on the OSM extract the provider runs; not under our control |
| Verification | A route is a computed suggestion, labelled as such; it is not an accessibility fact and carries no per-segment guarantee. Routes show attribution |
| When unavailable | `RoutingProvider` returns an error; the UI says routing is unavailable and still shows place data. Other providers (self-hosted ORS, others) can implement the interface |

### `ztp-gtfs-rt` — ZTP Kraków GTFS and GTFS-Realtime (transit departures)

| | |
|---|---|
| Origin | Zarząd Transportu Publicznego w Krakowie, https://gtfs.ztp.krakow.pl (feeds published by MPK S.A. and, for Mobilis buses, R&G PLUS per `feed_info.txt`) |
| Endpoint | Per feed `T` (MPK trams), `A` (MPK buses), `M` (Mobilis buses): `GTFS_KRK_<id>.zip` (timetable; we read `stops`, `routes`, `trips`), `TripUpdates_<id>.pb` and `VehiclePositions_<id>.pb` (GTFS-Realtime protobuf). Base URL `ZTP_GTFS_BASE_URL` |
| What we read | Stops within 400 m of a place (grouped by name), predicted departures in the next hour, and `VehicleDescriptor.wheelchair_accessible` of the vehicle on each trip |
| Licence | **To confirm.** No licence or terms next to the files (checked 2026-10-03); none found on otwartedane / dane.gov.pl. `ZTP_SOURCE.licenseConfirmed = false`, so a production build answers `mode: disabled` and the card says the data awaits licence confirmation |
| Freshness | Realtime files are regenerated every few seconds; the server reads them at most every 30 s and shows the feed's own timestamp ("dane z …"). Timetable zips are re-read every 12 h |
| Verification | What the flag says on 2026-10-03: every one of 122 trams is `WHEELCHAIR_ACCESSIBLE`, high-floor trams included, so for trams it is a default and shown as „Niezweryfikowane” (reliability `inferred`); bus feeds send no flag at all, shown as „Brak danych”. Only a flag from a feed we trust (buses, if ZTP starts sending it) becomes „Pojazd dostępny / niedostępny dla wózka” (`confirmed`); `WHEELCHAIR_INACCESSIBLE` is always believed. A realtime trip missing from the timetable is left out |
| When unavailable | The last data read stays in memory and is served with `refreshStatus: outage` and its time („Pokazujemy ostatnie pobrane, z …”); with nothing read yet the card says to check the stop's board. `outage` means every feed (T, A, M) failed; when only some fail, the status follows the working ones and `statusNote` (shown on the card) names the missing modes, e.g. „Część danych przewoźnika jest niedostępna (autobusy)”. Live data more than 5 minutes old (the feed answers but stopped updating) is `stale` and the card says so („Dane przewoźnika nie odświeżają się od …”), not that the operator is down. `lastSuccessAt` is our last good read; `fetchedAt` is when the operator produced the data. An empty `VehiclePositions` file (seen during the day) only drops the vehicle data — departures stay, vehicles read „Brak danych”. A failing endpoint never breaks the place card. `SIMULATE_SOURCE_OUTAGE=ztp-gtfs-rt` simulates it |
| Tests | Recorded with `npm run transit:record -w apps/web` into `apps/web/src/server/transit/fixtures/ztp-<date>.json` (cut to the city centre); tests and e2e use it (`TRANSIT_FEED=recorded`) and the UI labels it as a recording, never as live |

### OpenFreeMap — base map tiles

| | |
|---|---|
| Origin | OpenFreeMap public instance, https://openfreemap.org |
| Use | Vector tiles loaded by MapLibre GL in the browser (the only external call the browser makes for the map) |
| Licence / terms | Project licence MIT; map data from OpenStreetMap (ODbL); schema is OpenMapTiles. Site states attribution is required: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (automatic with MapLibre; the OpenFreeMap part is optional), commercial use allowed, no request limits. Its terms of service say availability is aimed for but not guaranteed |
| When unavailable | The map does not draw; every place and route is also available as a list and as text (R6), so the app stays usable |

### Hosting

Vercel (web) and managed Postgres are infrastructure, not data sources. See `docs/deployment.md`.

## Not sources

User reports, owner declarations and demo additions are not open data. They are stored with their
own provenance, and sample records are labelled "PRZYKŁAD" everywhere.
