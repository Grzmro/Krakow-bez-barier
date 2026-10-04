# Accessibility facts and provenance

The core idea of the product, and what the jury checks hardest (R1, R2, R4 and the "failure case"
in `docs/challenge.md`). Read before touching ingestion, the API or the place/route UI.

## Principles

1. **Concrete facts, not a label.** We store and show "3 steps, 17 cm each", "door 80 cm", "no
   accessible toilet" — never only "accessible / not accessible". OSM's `wheelchair=yes|limited|no`
   is kept as one fact among others (`wheelchair_overall`), not as the answer.
2. **Every fact carries its provenance:** where it came from, when we fetched it, when the source
   says it was true, and how reliable it is.
3. **Unknown ≠ accessible.** A missing fact is shown as "brak danych", neutral, never green. A
   result is never better than the data behind it.
4. **Conflicts are shown, not resolved silently.** Two sources disagree → the user sees both values
   with sources and dates.
5. **Needs, not diagnoses (R4).** The user sets barrier/facility preferences (max step height, min door
   width, needs an accessible toilet, avoid cobblestones, max incline). We never ask about disability.
   The profile stays in the browser.

## Model (to be defined in `packages/contracts/openapi.yaml`)

- **Source:** `id`, name, kind (`official_open_data` / `community` / `venue_owner` / `user_report` /
  `sample`), URL, license, terms URL, attribution, update frequency, base reliability, last
  ingestion run (`ok` / `partial` / `failed`, time, error).
- **Place:** name, category, GeoJSON location, address, external refs (`osm:node/123`).
  Optional **Entrance** (main / side), because accessibility often differs per entrance.
- **AccessibilityFact:** `subject` (place / entrance / way / node / stop), `attribute`, `value`,
  `unit`, `sourceId`, `sourceRecordRef`, `fetchedAt`, `observedAt?`, `confirmedAt?`, `reliability`,
  `evidence?` (URL, quote, photo), `status` (`active` / `superseded` / `disputed`).
- **Attribute vocabulary** (one shared list, extended there): `step_count`, `step_height_cm`,
  `ramp`, `lift`, `door_width_cm`, `entrance_level`, `toilet_accessible`, `changing_table`,
  `surface`, `smoothness`, `incline_pct`, `kerb_height_cm`, `bench`, `disabled_parking`,
  `wheelchair_overall`, `levels` (storeys the place spans), `automatic_door`. A fact about one entrance
  (OSM `entrance=*` node) carries `entrance` (main / secondary / service / shop / unspecified).
- **Reliability:** `confirmed` (official source or verified by owner/moderator) > `community` (OSM) >
  `extracted` (automatic, e.g. from an accessibility declaration) > `user_report` (unverified) >
  `inferred`. `sample` is always labeled "PRZYKŁAD".
- **ResolvedAttribute** (what the UI renders): `state` = `known` / `unknown` / `conflict` / `stale`,
  the best fact by reliability, all facts, and an effective trust that decays with the fact's age.
- **NeedVerdict** per user need: `met` / `barrier` / `unknown` / `conflict`, with the facts that
  justify it ("Dlaczego?").
- **Report:** proposed correction for a subject/attribute, comment, optional photo (EXIF stripped),
  status `new` / `accepted` / `rejected`. No account, no e-mail. Shown as unverified until accepted.

## Pure logic, tested

- **Resolver:** facts of one attribute → `ResolvedAttribute` (priority, conflict detection,
  staleness).
- **Matcher:** resolved attributes × needs profile → verdict per need.

Both are pure functions with unit tests; they are where most of the product's correctness lives.

## Failure cases the demo must show

- A source is unavailable → last known data is shown with "Źródło niedostępne, dane z <data>".
- Conflicting data → both values, both sources.
- No data for a need → "Nie wiemy", never a pass.
