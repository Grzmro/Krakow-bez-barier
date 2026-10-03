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
| `msip-toilets` | MSIP "Toalety publiczne" (`WT_WC_2023`) | city public toilets, accessibility fields | Not stated in the service; MSIP regulation limits reuse to data classified "OPEN DATA" | **To confirm** | only after confirmation |
| `zdmk-parking-ozn` | ZDMK "Miejsca postojowe OZN" (ArcGIS Online) | marked parking spaces for disabled drivers | No licence in the ArcGIS item | **To confirm** | only after confirmation |
| `ztp-stops` | ZTP "Przystanki Komunikacji Miejskiej w Krakowie" (ArcGIS Online) | stop inventory: benches, platform surface | No licence in the ArcGIS item | **To confirm** | only after confirmation |
| `msip-koh` | MSIP "Obiekty hotelarskie KOH" (`WT_OBIEKTY_HOTELOWE_KOH`) | hotel names/categories/addresses, no accessibility fields | Not stated; derived from the national register of hotel facilities | **To confirm** | only after confirmation |
| (runtime) | openrouteservice | routing, not stored | Service terms (HeiGIT) | Partly confirmed | no (on demand, server-side) |
| (runtime) | OpenFreeMap tiles | base map | MIT (project); map data OSM/ODbL | Confirmed | no (browser loads tiles) |

## Accessibility-data sources

### `osm` — OpenStreetMap via Overpass

| | |
|---|---|
| Origin | OpenStreetMap community, read through the Overpass API |
| Endpoint | Overpass API instance configured in the city config (not hard-coded) |
| What we read | `tourism` (museum, hotel, hostel, guest_house, gallery, attraction), `amenity` (restaurant, cafe, toilets, pharmacy, theatre, cinema, library); tags `wheelchair`, `toilets:wheelchair`, `wheelchair:description`, `changing_table`, `check_date`, ... |
| Licence | Open Database Licence (ODbL) 1.0 |
| Attribution | "© OpenStreetMap contributors" (shown wherever OSM-derived facts or the map are shown) |
| Freshness | Per object. `check_date` is stored as `observedAt` when present, otherwise the fact has no observation date and is shown as such |
| Update frequency | Ingest re-reads on the GitHub Actions cron (configured in the workflow) |
| Verification | Provenance `osm:<type>/<id>@v<version>`. Reliability is a community claim, lower than a declared or surveyed fact; a recent `check_date` raises it, a missing one lowers it. Conflicts with other sources are shown side by side, never merged |
| When unavailable | The run is logged as `failed` in `ingestion_run`, previous facts are kept and marked stale ("Źródło niedostępne, dane z <date>"). Nothing is deleted |
| Coverage caveat | In the demo bbox only 99 of 649 objects (15%) have `wheelchair=*`; steps, door width and ramp tags are almost absent. Details: `docs/demo-data.md` |
| Usage rules | Respect Overpass rate limits, send a descriptive `User-Agent`, cache downloads in development |

Share-alike: our derived database of OSM facts is a derivative database under ODbL — see
`docs/deployment.md` (Licences).

### `msip-toilets` — MSIP "Toalety publiczne"

| | |
|---|---|
| Origin | Miasto Kraków, Miejski System Informacji Przestrzennej (MSIP), Obserwatorium portal. Service description: "Toalety publiczne w Krakowie na podstawie danych z ISDP". Which unit maintains it: **to confirm** (the service only says "ISDP"). Toilets are operated by ZIW Kraków |
| Endpoint | `https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_WC_2023/MapServer/0` (ArcGIS REST, `query` with `f=json`; pagination unsupported — one query) |
| What we read | 50 toilets; `nplnsprw` (access for disabled people), `rodz_npl` (type of modification), `przewijak` (changing table), `godziny`, `status` |
| Licence | **To confirm.** The ArcGIS service metadata has an empty `copyrightText` and no licence. The MSIP regulation ("Regulamin Miejskiego Systemu Informacji Przestrzennej (MSIP) i zasady ponownego wykorzystania informacji sektora publicznego", https://msip.krakow.pl/?dok_id=228972, updated 2025-10-29) says the download service offers only data classified "OPEN DATA - Pobieralne"; other data is informational, for browsing. It also forbids commercial redistribution of content in IT systems and requires citing the source. We have **not** verified that this layer is classified OPEN DATA |
| Attribution (per regulation, if reuse is allowed) | "Gmina Miejska Kraków, Portal MSIP Obserwatorium (https://msip.krakow.pl)" |
| Freshness | Dataset year 2023 (layer name); the fetch date is stored as `fetchedAt`. No per-record date, so the UI shows "dataset 2023" |
| Update frequency | Unknown, no published schedule. Treated as static; re-read on the cron |
| Verification | No ID or OSM ref; matched to OSM toilets by distance (all 9 in the demo bbox are within 13 m). Reliability: official city dataset, but old. Disagreements with OSM are shown as "Sprzeczne dane" (e.g. changing table at ul. Konopnickiej) |
| When unavailable | Same as above. The older host `msip3.um.krakow.pl` returns 404 (2026-10-03); the live demo uses it to simulate an outage (KBB-29) |
| Adapter | `apps/ingest/src/adapters/msip-toilets.ts`, mapper tested on `apps/ingest/test/fixtures/msip-toilets-sample.json` (the 9 toilets in the demo bbox, recorded 2026-10-03). `nplnsprw` "tak…" / "nie" → `wheelchair_overall` yes / no; `rodz_npl` "pochylnia" → `ramp`, "winda" / "platforma" → `lift`; `przewijak` "Tak" / "brak" → `changing_table`. The original wording is kept as the evidence comment. Record ref `msip-toilets:WT_WC_2023/<ESRI_OID>`. `licenseConfirmed: false`, so the CLI and the runner refuse to load it |

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
| Adapter | `apps/ingest/src/adapters/zdmk-parking-ozn.ts`: one place per space (category `other`) with `disabled_parking = true`; ref `zdmk-parking-ozn:space/<ID_MIEJSCA>`. Fixture `zdmk-parking-ozn-sample.json`. Not matched to OSM (OSM places we ingest carry no parking spaces) |
| When unavailable | As for `osm`: last data kept, marked stale |

### `ztp-stops` — ZTP "Przystanki Komunikacji Miejskiej w Krakowie"

| | |
|---|---|
| Origin | ArcGIS Online organisation of Gmina Miejska Kraków (`gmk-2`), item "Przystanki Komunikacji Miejskiej w Krakowie" (https://gmk-2.maps.arcgis.com/home/item.html?id=73cfc1778d0d4305a643ef0d2cb13e1f); item snippet: "Baza przystanków w Krakowie oraz aglomeracji, prowadzona przez Zarząd Transportu Publicznego w Krakowie" |
| Endpoint | `https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services/Przystanki_Komunikacji_Miejskiej_w_Krakowie/FeatureServer/0` (public, no key; 3,756 platforms, 88 in the demo bbox) |
| What we read | `Nazwa_przystanku_nr`, `kod_busman`, `Grupa`, `Nawierzchnia_peronu`, `Krawężnik_peronowy`, `Wiata_liczba`, bench counts, `EditDate` |
| Licence | **To confirm.** The item has empty `licenseInfo` and `accessInformation` |
| Freshness | Per record: `EditDate` is stored as `observedAt` |
| Adapter | `apps/ingest/src/adapters/ztp-stops.ts`: one place per platform (category `other`). Benches outside the shelter > 0 → `bench = true`; no shelter and no seats → `bench = false`; a shelter without other seats → no fact (the inventory does not count shelter benches). Platform surface → `surface` (`asfalt` asphalt, `beton` concrete, `kostka` / `płyty_chodnikowe` paving_stones). Kassel kerbs have no height in the data → skipped and counted. Suspended stops (`Grupa = KMK_zawieszony`) are skipped. Ref `ztp-stops:stop/<kod_busman>` (GlobalID when missing). Fixture `ztp-stops-sample.json` |
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
