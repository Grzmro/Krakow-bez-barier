# Demo data

Real places and real data for the live demo (KBB-9). Nothing here is invented: every value was
read from the sources below on 2026-10-03. Anything we add on top (owner declarations, user
reports) is sample data and is labeled "PRZYKŁAD" in the UI.

## Demo area

**Stare Miasto + Kazimierz + Stradom**, bbox `50.045,19.925 – 50.060,19.960` (S,W – N,E). It has the
densest OSM coverage, the Planty/Dietla public toilets (the only place where city data and OSM
overlap), and is where tourists actually walk. Wawel and Podgórze are one step outside it; extend
the bbox only if a demo place needs it.

## Sources

| Source | What we read | Snapshot | Freshness | Terms |
|---|---|---|---|---|
| **OpenStreetMap** via Overpass (`tourism`: museum, hotel, hostel, guest_house, gallery, attraction; `amenity`: restaurant, cafe, toilets, pharmacy, theatre, cinema, library) | 649 objects in the bbox | OSM base 2026-07-24 | per object (`check_date` where present) | ODbL 1.0, attribution "© OpenStreetMap contributors" |
| **MSIP: Toalety publiczne** — `msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_WC_2023/MapServer/0` (ArcGIS REST, `query` with `f=json`) | 50 city toilets, 9 in the bbox; fields incl. `nplnsprw` (access for disabled people), `rodz_npl` (type of modification), `przewijak`, `godziny`, `status` | 2026-10-03 | dataset 2023, "based on ISDP data" per service description | **To confirm** (KBB-20) |
| **MSIP: Obiekty hotelarskie KOH** — `.../Obserwatorium/WT_OBIEKTY_HOTELOWE_KOH/MapServer/0` | 204 accommodation facilities: name, category, street, address; **no accessibility fields** | import date 2023-06-30 | 2023 | **To confirm** (KBB-20) |

Notes for ingest (KBB-18, KBB-27):

- The MSIP layer rejects `resultOffset`/pagination ("Pagination is not supported") — fetch with one
  query; both layers are small.
- The city toilets layer has no ID or OSM ref. Match to OSM by distance: all 9 in the bbox have an
  OSM toilet within 13 m.
- Public toilets are operated by ZIW Kraków; OSM carries `operator=ZIW Kraków` on some of them.
- Nothing in either source gives step count, door width or ramp data — see the coverage numbers.

## What the data actually contains

In the bbox, OSM has **99 of 649 objects (15%)** with `wheelchair=*`. Concrete barrier tags are
almost absent:

| OSM tag | Objects |
|---|---|
| `wheelchair` | 99 |
| `toilets:wheelchair` | 7 |
| `wheelchair:description` | 3 |
| `step_count`, `door:width`, `entrance:width`, `ramp:wheelchair` | 0 |

So for most places the honest answer is "wheelchair yes/limited/no" plus "Brak danych" for steps,
door width and ramp. The demo must say this out loud rather than hide it: the product's point is
showing what we know, from where, and what we don't. Toilets are the one category where concrete,
sourced facts exist (city dataset + OSM).

### Coverage after our own OSM ingest

The same bbox, as stored by `npm run ingest` (OSM adapter with the category set from
`packages/contracts/src/categories.ts`, KBB-32; local run of 2026-10-03 17:40 UTC from the Geofabrik
extract of 2026-10-02, after Overpass failed). It stores 960 places, not the 649 read above, because
the category list is different (e.g. `fast_food`, `bar`, `pub`, historic `monument`/`memorial`; no
`library`) and places without a name are skipped, except toilets, which are kept as "Toaleta publiczna":

| Measure | Places |
|---|---|
| OSM places stored | 960 |
| with `wheelchair_overall` (`wheelchair=*`) | 130 (13.5%): 64 yes, 20 limited, 46 no |
| ... of which with an observation date (`check_date`) | 42 |
| with `toilet_accessible` / `changing_table` | 7 / 9 |
| with `step_count`, `door_width_cm`, `ramp`, `lift` | 0 |

The OSM mapper reads `step_count`, `door:width`, `entrance:width` and `ramp:wheelchair`
and `elevator` (`apps/ingest/src/adapters/osm-map.ts`), so the zeros are the data, not a missing mapping. To
reproduce every figure in the table on a database after ingest (read-only):

```sql
-- OSM places stored (960)
SELECT count(*) FROM places WHERE external_ref LIKE 'osm:%';

-- places per attribute (130 wheelchair_overall, 7 toilet_accessible, 9 changing_table;
-- step_count, door_width_cm, ramp, lift are absent)
SELECT attribute, count(DISTINCT place_id)
FROM facts WHERE status = 'active' AND source_id = 'osm'
GROUP BY attribute ORDER BY 2 DESC;

-- yes / limited / no split (64 / 20 / 46)
SELECT value->>'text', count(*)
FROM facts WHERE status = 'active' AND source_id = 'osm' AND attribute = 'wheelchair_overall'
GROUP BY 1;

-- with an observation date from check_date (42)
SELECT count(*)
FROM facts WHERE status = 'active' AND source_id = 'osm' AND attribute = 'wheelchair_overall'
  AND observed_at IS NOT NULL;
```

City-wide we have only a preliminary count (2,674 of 30,573 Kraków POIs, 8.7%, with `wheelchair=*`
in the Geofabrik extract of 2026-10-03); the script for it is not in the repository, so the pitch
labels it "analiza własna".

## Demo places

`W` = OSM `wheelchair`. Refs are OSM element ids (`n` node, `w` way, `r` relation). Dates are the
`check_date` tag; "—" means the object has none.

### Museums

| Place | OSM | Facts we have | Use in demo |
|---|---|---|---|
| Pałac Biskupa Erazma Ciołka | n1516840253 | W=yes; description: "niemal nieograniczony, część jednej sali w galerii sztuki cerkiewnej ma stopień bez podjazdu"; date — | Best museum: a yes with a concrete caveat — shows facts beyond a label |
| Apteka Pod Orłem | n979972831 | W=limited; description: "jest wyciągana dostawka na schody"; date — | Limited with a concrete workaround (portable ramp) |
| Muzeum Archeologiczne | r1863002 | W=no, building:levels=4 (4 storeys); date — | Clear barrier case |
| Wawel Odzyskany | n12320094259 | W=yes only; date — | Incomplete: yes, but no detail |
| Muzeum Banksy | n12161657501 | W=limited; checked 2024-09-09 | Older check, no description → stale-ish |

### Restaurants and cafes

| Place | OSM | Facts we have | Use in demo |
|---|---|---|---|
| Kuchnia u Doroty (Augustiańska) | n2135606464 | W=yes, toilets:wheelchair=yes; checked 2025-09-11 | Best restaurant: yes + toilet, recent check |
| Kazimir (Miodowa) | n4730384560 | W=no, toilets:wheelchair=no; checked 2025-07-31 | Barrier with recent check |
| Czarna kaczka (Poselska) | n4986442006 | W=limited, toilets:wheelchair=no, level=0 (1 storey); checked 2024-07-12 | Limited + toilet barrier |
| Taste of India (Dietla) | n2000514300 | W=yes; checked 2025-09-13 | Plain yes |
| Nat Bistro (Krakowska) | n10222457076 | W=limited; checked 2026-07-17 | Freshest check |

### Hotels

| Place | OSM | KOH (city) | Facts we have | Use in demo |
|---|---|---|---|---|
| Hotel Miodowa | n5274182623 | "MIODOWA", 3 stars | W=yes only | Two sources, none with barrier detail → incomplete |
| Qubus Hotel | w85676236 | "QUBUS HOTEL KRAKÓW", 4 stars | W=yes, building:levels=9 (9 storeys); checked 2026-02-11 | Recently confirmed yes |
| Aparthotel Spatz (Miodowa) | w152104759 | not matched | W=no; checked 2025-09-30 | Barrier |
| Novotel Kraków Centrum | n2217193962 | "NOVOTEL KRAKÓW CENTRUM", 4 stars | W=yes only | Yes with no detail |

### Public toilets (city dataset + OSM)

City columns are MSIP `nplnsprw` / `rodz_npl` / `przewijak`; OSM columns are `wheelchair` /
`changing_table`. Distance is city point → nearest OSM toilet.

| Place (city name) | City: accessible / modification / changing table | OSM element | OSM | Verdict for demo |
|---|---|---|---|---|
| ul. Konopnickiej (przejście podziemne) | tak, oddzielnie / pochylnia / **brak** | n5270846528 (5 m) | W=yes, changing_table=**yes** | **Conflict** on changing table |
| ul. Sienna (Planty) | tak, po stronie damskiej / platforma / tak | n274115139 (5 m) | no `wheelchair` | City fills a gap OSM has |
| ul. Powiśle (bulwar) | tak, po stronie damskiej / platforma / brak | w1039863501 (3 m) | no `wheelchair` | City fills a gap OSM has |
| ul. Dietla / Starowiślna | tak / wjazd z poziomu 0 / tak | n2984350171 (2 m) | W=yes | Two sources agree → confirmed |
| Pl. Bohaterów Getta (przejście podziemne) | tak, pomiędzy toaletą damską a męską / winda / brak | n283018590 (13 m) | W=yes | Agree; lift to the toilet |

The other 4 city toilets in the bbox (Straszewskiego, Smocza, Daszyńskiego, Rynek Dębnicki) also
match an OSM toilet within 11 m; they are fallback examples.

## The three failure cases

### 1. Conflicting data — toilet at ul. Konopnickiej

- **In the data:** MSIP says `przewijak = brak` (no changing table). OSM n5270846528 says
  `changing_table=yes`, operator ZIW Kraków. Both agree the toilet is wheelchair accessible
  (MSIP: separate, ramp; OSM `wheelchair=yes`).
- **User sees:** for the "changing table" need (Wózek dziecięcy profile) a "Sprzeczne dane" status
  with both values side by side — "Brak" from MSIP (date: dataset 2023) and "Tak" from OSM — never
  a pass or a single merged answer. Wheelchair access stays "potwierdzone", because the sources
  agree on it. Report/confirm buttons are next to the conflict.

### 2. Incomplete data — Hotel Miodowa (fallback: Wawel Odzyskany)

- **In the data:** OSM has `wheelchair=yes` and nothing else; the city KOH layer has the hotel
  (name, category, address) and no accessibility fields at all. No steps, door width, ramp or
  lift.
- **User sees:** "Dostępne" as an OSM community claim with its date, and "Brak danych" (neutral
  grey, not green) for entrance steps, door width, ramp, lift and toilet. For a profile that
  needs a step-free entrance of at least 90 cm, the verdict is "Nie wiemy", not "pasuje".

### 3. Unavailable source — MSIP

- **In the data:** `msip.um.krakow.pl` answers (the ArcGIS services above). The older host
  **`msip3.um.krakow.pl/arcgis/...` returns 404** (checked 2026-10-03: `/arcgis/rest/services` and
  both layer URLs; the host root redirects to `/portal/`). We simulate the outage by pointing the
  MSIP adapter at the dead host (KBB-29), so the effect is reproducible in the demo.
- **User sees:** the city toilet facts keep their last values from the previous run, with
  "Źródło niedostępne, dane z <date ostatniego pobrania>" and an "Nieaktualne" reliability chip;
  the "O danych" page shows MSIP as failed with the error and the last success time. The OSM
  facts of the same toilets are unaffected. The toilet from case 1 then shows the conflict
  with an outdated city side.

## Suggested demo flow (Wózek dziecięcy profile)

1. Search "toalety" in the demo area → list with summaries; Konopnickiej shows the conflict.
2. Open it → both values with sources and dates ("Skąd wiemy?").
3. Switch MSIP to failed → same card shows stale city data and the banner.
4. Open Hotel Miodowa → "Brak danych" for everything except the OSM claim.
5. Open Kuchnia u Doroty → the contrast: recent check, toilet confirmed.

## Open points

- MSIP / KOH licence and terms of reuse are not confirmed — resolve in KBB-20 before the
  submission names them as sources (challenge R3).
- Which public body maintains the toilets layer (service says "ISDP") — check before naming an
  owner in the source registry.
- The OSM snapshot is 2026-07-24; ingest (KBB-18) re-reads it, so check values still hold
  before recording the video.
