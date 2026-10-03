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

**Decision rule until the MSIP licences are confirmed:** the two MSIP adapters are written and
tested on recorded fixtures, but they are not run against the live service in production, and the
submission names the MSIP layers as "licence to confirm". Confirmation path: ask the MSIP
Administrator (the regulation names this role) whether `WT_WC_2023` and `WT_OBIEKTY_HOTELOWE_KOH`
are classified OPEN DATA and under which licence, and check https://otwartedane.krakow.pl for a
matching dataset record. We could not complete either from here.

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
