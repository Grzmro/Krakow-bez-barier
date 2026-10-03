// Sample data set. Every value here is PRZYKŁAD, except the msip3.um.krakow.pl outage (real 404).

export type Status = "met" | "barrier" | "conflict" | "unknown"
export type Reliability = "confirmed" | "unverified" | "outdated" | "conflict" | "unknown"
export type Level = "official" | "community" | "report"
export type Profile = "wheelchair" | "stroller"
export type Category = "restaurant" | "museum" | "toilet" | "hotel" | "monument" | "theatre" | "shop"
export type FeatureKey = "entrance" | "door" | "ramp" | "elevator" | "surface" | "toilet" | "rest" | "parking" | "changing"
export type SourceId = "osm" | "ziw" | "decl" | "zdmk" | "owner" | "reports"

export type Entrance = { steps: number; cm: number }
export type FactValue = Entrance | number | boolean | string

export interface Evidence {
  value: FactValue
  label: string
  source: SourceId
  level: Level
  date: string
  confirmations?: number
  mine?: boolean
  comment?: string
}

export interface Place {
  id: string
  name: string
  category: Category
  address: string
  entranceHint: string
  distance: number
  x: number
  y: number
  phone?: string
  www?: string
  facts: Partial<Record<FeatureKey, Evidence[]>>
}

export const TODAY = "03.10.2026"
const TODAY_RANK = 2026 * 12 + 10

const decl = (value: FactValue, label: string, date = "03.2026"): Evidence => ({ value, label, source: "decl", level: "official", date })
const osm = (value: FactValue, label: string, date = "06.2026", confirmations = 1): Evidence => ({
  value,
  label,
  source: "osm",
  level: "community",
  date,
  confirmations,
})
const ziw = (value: FactValue, label: string): Evidence => ({ value, label, source: "ziw", level: "official", date: "11.2023" })
const zdmk = (value: FactValue, label: string): Evidence => ({ value, label, source: "zdmk", level: "official", date: "09.2026" })
const e = (steps: number, cm: number): Entrance => ({ steps, cm })

export const PLACES: Place[] = [
  {
    id: "krzysztofory",
    name: "Pałac Krzysztofory",
    category: "museum",
    address: "Rynek Główny 35",
    entranceHint: "Brama od strony Rynku, drzwi po prawej.",
    distance: 140,
    x: 470,
    y: 482,
    phone: "12 000 00 01",
    www: "muzeum-przyklad.pl",
    facts: {
      entrance: [decl(e(0, 0), "0 cm")],
      door: [decl(110, "110 cm")],
      elevator: [osm(true, "jest", "06.2026", 1)],
      surface: [osm("równa", "płyty, równa", "05.2026", 2)],
      toilet: [ziw(true, "Jest, platforma"), osm(false, "Brak", "06.2026")],
      parking: [zdmk(true, "2 miejsca, 60 m")],
    },
  },
  {
    id: "narodowe",
    name: "Muzeum Narodowe",
    category: "museum",
    address: "al. 3 Maja 1",
    entranceHint: "Wejście od ul. Piłsudskiego, bez stopni.",
    distance: 650,
    x: 120,
    y: 600,
    phone: "12 000 00 02",
    facts: {
      entrance: [decl(e(0, 0), "0 cm")],
      door: [decl(120, "120 cm")],
      elevator: [decl(true, "jest")],
      surface: [decl("równa", "asfalt")],
      toilet: [decl(true, "dostosowana")],
      rest: [decl(true, "ławki w holu")],
      parking: [zdmk(true, "4 miejsca")],
      changing: [decl(true, "jest")],
    },
  },
  {
    id: "sukiennice",
    name: "Sukiennice",
    category: "museum",
    address: "Rynek Główny 3",
    entranceHint: "Winda od strony wschodniej, przy schodach.",
    distance: 50,
    x: 525,
    y: 640,
    facts: {
      entrance: [decl(e(0, 0), "0 cm", "02.2026")],
      door: [decl(90, "90 cm", "02.2026")],
      elevator: [decl(true, "jest", "02.2026")],
      surface: [osm("równa", "płyty", "07.2026", 2)],
      toilet: [osm(true, "dostosowana", "05.2026", 1)],
      rest: [osm(true, "ławki na Rynku", "07.2026", 1)],
      changing: [decl(true, "jest", "02.2026")],
    },
  },
  {
    id: "hipolitow",
    name: "Kamienica Hipolitów",
    category: "museum",
    address: "pl. Mariacki 3",
    entranceHint: "Wejście z placu Mariackiego.",
    distance: 260,
    x: 692,
    y: 548,
    facts: {
      entrance: [osm(e(3, 17), "3 stopnie · 17 cm", "06.2025")],
      ramp: [osm(false, "brak", "06.2025")],
      door: [osm(85, "85 cm", "06.2025")],
      elevator: [osm(false, "brak", "06.2025")],
      surface: [osm("kostka", "kostka", "06.2025")],
    },
  },
  {
    id: "podziemia",
    name: "Podziemia Rynku",
    category: "museum",
    address: "Rynek Główny 1",
    entranceHint: "Wejście przez Sukiennice, winda przy kasie.",
    distance: 80,
    x: 568,
    y: 548,
    facts: {
      entrance: [osm(e(0, 0), "0 cm", "05.2026", 2)],
      door: [osm(100, "100 cm", "05.2026")],
      elevator: [
        osm(true, "Jest", "05.2026"),
        { value: false, label: "Nie działa", source: "reports", level: "report", date: "01.10.2026" },
      ],
      toilet: [osm(true, "dostosowana", "05.2026")],
    },
  },
  {
    id: "mariacki",
    name: "Kościół Mariacki",
    category: "monument",
    address: "pl. Mariacki 5",
    entranceHint: "Wejście dla turystów od placu Mariackiego.",
    distance: 120,
    x: 640,
    y: 488,
    facts: {
      entrance: [osm(e(1, 12), "1 stopień · 12 cm", "04.2026", 2)],
      ramp: [osm(true, "rampa dla wózka", "04.2026")],
      door: [osm(140, "140 cm", "04.2026")],
      elevator: [osm("na", "nie dotyczy", "04.2026")],
      changing: [osm(true, "jest", "04.2026")],
    },
  },
  {
    id: "slowackiego",
    name: "Teatr im. J. Słowackiego",
    category: "theatre",
    address: "pl. Św. Ducha 1",
    entranceHint: "Wejście główne od placu Św. Ducha.",
    distance: 550,
    x: 728,
    y: 330,
    phone: "12 000 00 03",
    facts: {
      entrance: [osm(e(2, 15), "2 stopnie · 15 cm", "2022")],
      door: [osm(120, "120 cm", "2022")],
      elevator: [osm(true, "jest", "2022")],
    },
  },
  {
    id: "restauracja",
    name: "Restauracja Przykład",
    category: "restaurant",
    address: "ul. Szewska 7",
    entranceHint: "Wejście z ulicy, szyld nad drzwiami.",
    distance: 300,
    x: 380,
    y: 575,
    phone: "12 000 00 04",
    www: "restauracja-przyklad.pl",
    facts: {
      entrance: [osm(e(0, 3), "próg 3 cm", "08.2026")],
    },
  },
  {
    id: "kawiarnia",
    name: "Kawiarnia Przykład",
    category: "restaurant",
    address: "ul. Grodzka 12",
    entranceHint: "Brak opisu wejścia.",
    distance: 320,
    x: 560,
    y: 768,
    facts: {},
  },
  {
    id: "toaleta-planty",
    name: "Toaleta miejska, Planty",
    category: "toilet",
    address: "Planty, przy Barbakanie",
    entranceHint: "Pawilon na Plantach, 30 m od Barbakanu.",
    distance: 450,
    x: 655,
    y: 252,
    facts: {
      entrance: [ziw(e(0, 0), "0 cm")],
      toilet: [ziw(true, "platforma")],
      changing: [ziw(true, "jest")],
      rest: [osm(true, "ławki obok", "07.2026")],
    },
  },
  {
    id: "galeria",
    name: "Galeria Krakowska",
    category: "shop",
    address: "ul. Pawia 5",
    entranceHint: "Wejście od strony Dworca, drzwi automatyczne.",
    distance: 1100,
    x: 858,
    y: 120,
    facts: {
      entrance: [osm(e(0, 0), "0 cm", "07.2026", 3)],
      door: [osm(180, "180 cm, automatyczne", "07.2026", 2)],
      elevator: [osm(true, "jest", "07.2026", 2)],
      toilet: [osm(true, "dostosowana", "07.2026", 2)],
      parking: [zdmk(true, "parking podziemny")],
      changing: [osm(true, "jest", "07.2026", 2)],
    },
  },
  {
    id: "czartoryskich",
    name: "Muzeum Książąt Czartoryskich",
    category: "museum",
    address: "ul. Pijarska 15",
    entranceHint: "Wejście od ul. Pijarskiej.",
    distance: 500,
    x: 548,
    y: 318,
    facts: {
      entrance: [decl(e(0, 0), "0 cm", "01.2026")],
      door: [decl(100, "100 cm", "01.2026")],
      elevator: [decl(true, "jest", "01.2026")],
      toilet: [decl(true, "dostosowana", "01.2026")],
      rest: [decl(true, "ławki w salach", "01.2026")],
    },
  },
  {
    id: "maius",
    name: "Collegium Maius",
    category: "museum",
    address: "ul. Jagiellońska 15",
    entranceHint: "Wejście przez dziedziniec.",
    distance: 400,
    x: 392,
    y: 640,
    facts: {
      entrance: [osm(e(2, 14), "2 stopnie", "03.2025")],
      ramp: [osm(true, "rampa dla wózka", "03.2025")],
      door: [osm(80, "80 cm", "03.2025")],
      surface: [osm("kostka", "kostka na dziedzińcu", "03.2025")],
      changing: [osm(true, "jest", "03.2025")],
    },
  },
  {
    id: "hotel",
    name: "Hotel Przykład",
    category: "hotel",
    address: "ul. Floriańska 40",
    entranceHint: "Wejście od Floriańskiej, recepcja na parterze.",
    distance: 380,
    x: 610,
    y: 360,
    phone: "12 000 00 05",
    www: "hotel-przyklad.pl",
    facts: {
      entrance: [{ value: e(0, 0), label: "0 cm", source: "owner", level: "official", date: "09.2026" }],
      door: [{ value: 90, label: "90 cm (pokój)", source: "owner", level: "official", date: "09.2026" }],
      elevator: [{ value: true, label: "jest", source: "owner", level: "official", date: "09.2026" }],
      toilet: [{ value: true, label: "prysznic bez brodzika", source: "owner", level: "official", date: "09.2026" }],
    },
  },
]

// ---------- sources ----------

export interface Source {
  id: SourceId
  name: string
  license: string
  refresh: string
  verification: string
  lastUpdate: string
  realOutage?: boolean
}

export const SOURCES: Source[] = [
  { id: "osm", name: "OpenStreetMap (ekstrakt Geofabrik)", license: "ODbL 1.0", refresh: "codziennie", verification: "społeczność, potwierdzenia", lastUpdate: "03.10.2026 06:00" },
  { id: "ziw", name: "Toalety publiczne ZIW (msip3.um.krakow.pl)", license: "dane publiczne miasta", refresh: "co miesiąc", verification: "zarządca", lastUpdate: "01.10.2026", realOutage: true },
  { id: "decl", name: "Deklaracje dostępności podmiotów publicznych", license: "informacja publiczna", refresh: "co tydzień", verification: "zarządca", lastUpdate: "02.10.2026" },
  { id: "zdmk", name: "Miejsca postojowe dla osób z niepełnosprawnością (ZDMK)", license: "dane publiczne miasta", refresh: "co tydzień", verification: "zarządca", lastUpdate: "17.09.2026" },
  { id: "owner", name: "Dane obiektu (weryfikacja na miejscu)", license: "licencja obiektu", refresh: "przy zmianie", verification: "audyt na miejscu", lastUpdate: "09.2026" },
  { id: "reports", name: "Zgłoszenia użytkowników", license: "CC BY 4.0", refresh: "na bieżąco", verification: "moderacja", lastUpdate: "dziś" },
]

export const SOURCE_SHORT: Record<SourceId, string> = {
  osm: "OSM",
  ziw: "Miasto (ZIW)",
  decl: "Deklaracja",
  zdmk: "ZDMK",
  owner: "Dane obiektu",
  reports: "Zgłoszenie",
}

// ---------- reliability ----------

export function dateRank(d: string) {
  const full = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (full) return Number(full[3]) * 12 + Number(full[2])
  const m = d.match(/^(\d{2})\.(\d{4})$/)
  if (m) return Number(m[2]) * 12 + Number(m[1])
  const y = d.match(/^(\d{4})$/)
  if (y) return Number(y[1]) * 12 + 6
  return TODAY_RANK
}

export const isOutdated = (d: string) => TODAY_RANK - dateRank(d) > 12

export interface FactState {
  key: FeatureKey
  reliability: Reliability
  evidence: Evidence[]
  mine: Evidence[]
  value?: FactValue
  label?: string
  latest?: Evidence
}

export function factState(place: Place, key: FeatureKey): FactState {
  const all = place.facts[key] ?? []
  const evidence = all.filter((ev) => !ev.mine)
  const mine = all.filter((ev) => ev.mine)
  if (evidence.length === 0) return { key, reliability: "unknown", evidence, mine }
  const latest = [...evidence].sort((a, b) => dateRank(b.date) - dateRank(a.date))[0]
  const distinct = new Set(evidence.map((ev) => JSON.stringify(ev.value)))
  if (distinct.size > 1) return { key, reliability: "conflict", evidence, mine, latest }
  const base = { key, evidence, mine, latest, value: latest.value, label: latest.label }
  if (isOutdated(latest.date)) return { ...base, reliability: "outdated" }
  if (latest.level === "official" || (latest.confirmations ?? 0) >= 2) return { ...base, reliability: "confirmed" }
  return { ...base, reliability: "unverified" }
}

// ---------- profiles ----------

export interface Thresholds {
  maxThreshold: number
  minDoor: number
  noSteps: boolean
  elevator: boolean
  toilet: boolean
  surface: boolean
  changing: boolean
}

export const DEFAULT_THRESHOLDS: Record<Profile, Thresholds> = {
  wheelchair: { maxThreshold: 2, minDoor: 90, noSteps: true, elevator: true, toilet: true, surface: false, changing: false },
  stroller: { maxThreshold: 3, minDoor: 70, noSteps: false, elevator: true, toilet: false, surface: false, changing: true },
}

export interface NeedResult {
  key: FeatureKey
  status: Status
  reliability: Reliability
  value: string
  limit?: string
  reason: string
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one
  const d = n % 10
  const t = n % 100
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few
  return many
}
export const stepsText = (n: number) => `${n} ${plural(n, "stopień", "stopnie", "stopni")}`

const NEED_REASON: Record<FeatureKey, string> = {
  entrance: "wejście",
  door: "drzwi",
  ramp: "podjazd",
  elevator: "winda",
  surface: "nawierzchnia",
  toilet: "toaleta",
  rest: "odpoczynek",
  parking: "parking",
  changing: "przewijak",
}

function unresolved(key: FeatureKey, s: FactState, limit?: string): NeedResult {
  const status: Status = s.reliability === "conflict" ? "conflict" : "unknown"
  return { key, status, reliability: s.reliability, value: "?", limit, reason: NEED_REASON[key] }
}

function evalNeed(place: Place, th: Thresholds, key: FeatureKey): NeedResult | null {
  const s = factState(place, key)
  if (key === "entrance") {
    const limit = th.noSteps ? `bez stopni, próg ≤ ${th.maxThreshold} cm` : `≤ 1 stopień`
    if (s.value === undefined) return unresolved(key, s, limit)
    const v = s.value as Entrance
    const value = v.steps === 0 ? `próg ${v.cm} cm` : stepsText(v.steps)
    const base = { key, reliability: s.reliability, value, limit }
    if (v.steps === 0) {
      return v.cm <= th.maxThreshold
        ? { ...base, status: "met", reason: "" }
        : { ...base, status: "barrier", reason: `próg ${v.cm} cm` }
    }
    if (!th.noSteps && v.steps <= 1) return { ...base, status: "met", reason: "" }
    const ramp = factState(place, "ramp")
    if (ramp.value === true) return { ...base, value: `${value} · rampa`, status: "met", reason: "", reliability: ramp.reliability }
    const reason = v.steps === 1 ? `1 stopień ${v.cm} cm` : stepsText(v.steps)
    if (ramp.value === false || th.noSteps) return { ...base, status: "barrier", reason }
    return { ...base, value: `${value} · rampa ?`, status: ramp.reliability === "conflict" ? "conflict" : "unknown", reason: "podjazd" }
  }
  if (key === "door") {
    const limit = `min. ${th.minDoor} cm`
    if (s.value === undefined) return unresolved(key, s, limit)
    const cm = s.value as number
    return cm >= th.minDoor
      ? { key, reliability: s.reliability, value: `${cm} cm`, limit, status: "met", reason: "" }
      : { key, reliability: s.reliability, value: `${cm} cm`, limit, status: "barrier", reason: `drzwi ${cm} cm` }
  }
  if (key === "surface") {
    if (s.value === undefined) return unresolved(key, s)
    return s.value === "równa"
      ? { key, reliability: s.reliability, value: s.label ?? "", status: "met", reason: "" }
      : { key, reliability: s.reliability, value: s.label ?? "", status: "barrier", reason: String(s.label) }
  }
  if (s.value === undefined) return unresolved(key, s)
  if (s.value === "na") return null
  return s.value
    ? { key, reliability: s.reliability, value: s.label ?? "jest", status: "met", reason: "" }
    : { key, reliability: s.reliability, value: s.label ?? "brak", status: "barrier", reason: `brak: ${NEED_REASON[key]}` }
}

export function profileNeeds(profile: Profile, th: Thresholds, category: Category): FeatureKey[] {
  if (category === "toilet") return ["entrance", profile === "stroller" ? "changing" : "toilet"]
  const keys: FeatureKey[] = ["entrance", "door"]
  if (th.elevator) keys.push("elevator")
  if (th.surface) keys.push("surface")
  if (th.toilet) keys.push("toilet")
  if (th.changing) keys.push("changing")
  return keys
}

export interface Verdict {
  status: Status
  reason: string
  met: number
  total: number
  unconfirmed: boolean
  needs: NeedResult[]
}

/** Barrier beats conflict beats unknown; only all-known-and-met is "met". Missing data never becomes "met". */
export function matchVerdict(place: Place, profile: Profile, th: Thresholds): Verdict {
  const needs = profileNeeds(profile, th, place.category)
    .map((k) => evalNeed(place, th, k))
    .filter((n): n is NeedResult => n !== null)
  const total = needs.length
  const met = needs.filter((n) => n.status === "met").length
  const known = needs.filter((n) => n.status === "met" || n.status === "barrier").length
  const unconfirmed = needs.some((n) => n.status === "met" && n.reliability !== "confirmed")
  const barrier = needs.find((n) => n.status === "barrier")
  const base = { met, total, unconfirmed, needs }
  if (barrier) return { ...base, status: "barrier", reason: barrier.reason }
  const conflict = needs.find((n) => n.status === "conflict")
  if (conflict) return { ...base, status: "conflict", reason: conflict.reason }
  const unknown = needs.filter((n) => n.status === "unknown")
  if (unknown.length === 1) return { ...base, status: "unknown", reason: unknown[0].reason }
  if (unknown.length > 1) return { ...base, status: "unknown", reason: `${known} z ${total}` }
  return { ...base, status: "met", reason: `${met}/${total}` }
}

export const STATUS_SORT: Status[] = ["met", "conflict", "unknown", "barrier"]

// ---------- no-profile facts ----------

export const FACT_ORDER: FeatureKey[] = ["entrance", "door", "ramp", "elevator", "surface", "toilet", "rest", "parking", "changing"]

export function factValueText(s: FactState): string | null {
  if (s.value === undefined) return null
  if (s.key === "entrance") {
    const v = s.value as Entrance
    return v.steps === 0 ? `bez stopni · próg ${v.cm} cm` : `${stepsText(v.steps)} · ${v.cm} cm`
  }
  if (s.key === "door") return `${s.value} cm`
  if (s.value === "na") return "nie dotyczy"
  return s.label ?? (s.value ? "jest" : "brak")
}

/** One-line summary for the "for everyone" list (US-1.5). */
export function factSummary(place: Place): string {
  const ent = factState(place, "entrance")
  const parts: string[] = []
  if (ent.value !== undefined) {
    const v = ent.value as Entrance
    parts.push(v.steps === 0 ? (v.cm <= 2 ? "Wejście bez stopni" : `Próg ${v.cm} cm`) : `Wejście: ${stepsText(v.steps)}`)
  } else parts.push(ent.reliability === "conflict" ? "Wejście: sprzeczne dane" : "Wejście: brak danych")
  const el = factState(place, "elevator")
  if (el.value === true) parts.push("winda")
  else if (el.value === false) parts.push("bez windy")
  else if (el.value !== "na") parts.push(el.reliability === "conflict" ? "winda: sprzeczne" : "winda: brak danych")
  const wc = factState(place, "toilet")
  if (wc.value === true) parts.push("toaleta dostosowana")
  else if (wc.value === false) parts.push("toaleta: brak")
  else parts.push(wc.reliability === "conflict" ? "toaleta: sprzeczne" : "toaleta: brak danych")
  return parts.join(" · ")
}

export type FeatureFilter = "noSteps" | "elevator" | "toilet" | "rest" | "parking" | "changing"

/** "yes" known true, "no" known false, "unknown" no data or conflict. */
export function featureMatch(place: Place, f: FeatureFilter): "yes" | "no" | "unknown" {
  if (f === "noSteps") {
    const s = factState(place, "entrance")
    if (s.value === undefined) return "unknown"
    const v = s.value as Entrance
    if (v.steps === 0) return "yes"
    const ramp = factState(place, "ramp")
    return ramp.value === true ? "yes" : ramp.value === false ? "no" : "no"
  }
  const s = factState(place, f)
  if (s.value === undefined) return "unknown"
  if (s.value === "na") return "no"
  return s.value ? "yes" : "no"
}

export function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`
}

export function sourceSummary(place: Place) {
  const all = Object.values(place.facts).flat() as Evidence[]
  const sources = new Set(all.filter((x) => !x.mine).map((ev) => ev.source))
  const latest = all.filter((x) => !x.mine).sort((a, b) => dateRank(b.date) - dateRank(a.date))[0]
  return { count: sources.size, latest: latest?.date }
}

// ---------- route (static, PRZYKŁAD) ----------

export interface Segment {
  id: number
  name: string
  step: string
  length: number
  facts: string
  stairs?: number
  curbCm?: number
  unknown?: boolean
  source?: string
  points: [number, number][]
  strollerRamp?: boolean
}

export interface Route {
  id: "nostairs" | "shortest"
  minutes: number
  km: string
  segments: Segment[]
}

export const ROUTES: Route[] = [
  {
    id: "nostairs",
    minutes: 16,
    km: "1,2 km",
    segments: [
      { id: 1, name: "Hala dworca → wyjście", step: "Zjedź windą na pl. Jana Nowaka-Jeziorańskiego.", length: 180, facts: "winda · 0 stopni", source: "OSM · 06.2026", points: [[905, 205], [870, 222], [828, 232]] },
      { id: 2, name: "Przejście Basztowa", step: "Przejdź przez ul. Basztową na światłach.", length: 60, facts: "krawężnik 2 cm · sygnalizacja", curbCm: 2, source: "OSM · 06.2026", points: [[828, 232], [790, 236], [758, 240]] },
      { id: 3, name: "Planty", step: "Idź alejką Plant w lewo, do Bramy Floriańskiej.", length: 90, facts: "nawierzchnia ?", unknown: true, points: [[758, 240], [712, 256], [668, 268], [630, 270]] },
      { id: 4, name: "ul. Floriańska", step: "Przejdź przez Bramę i idź prosto Floriańską.", length: 330, facts: "płyty · nachylenie 2%", source: "OSM · 04.2026", points: [[630, 270], [592, 276], [594, 380], [600, 470]] },
      { id: 5, name: "Rynek Główny", step: "Na Rynku skręć w prawo, cel po lewej.", length: 540, facts: "płyty · 0 stopni", source: "OSM · 05.2026", points: [[600, 470], [570, 520], [545, 585]] },
    ],
  },
  {
    id: "shortest",
    minutes: 12,
    km: "0,9 km",
    segments: [
      { id: 1, name: "Hala dworca", step: "Wyjdź z hali w stronę przejścia podziemnego.", length: 150, facts: "0 stopni", source: "OSM · 06.2026", points: [[905, 205], [860, 236], [818, 252]] },
      { id: 2, name: "Przejście podziemne", step: "Zejdź do przejścia pod ul. Basztową.", length: 80, facts: "24 schody", stairs: 24, strollerRamp: true, source: "OSM · 08.2026", points: [[818, 252], [770, 266], [722, 280]] },
      { id: 3, name: "Planty → Floriańska", step: "Wyjdź na Planty i idź Floriańską.", length: 420, facts: "płyty", source: "OSM · 04.2026", points: [[722, 280], [650, 284], [596, 290], [598, 380], [600, 470]] },
      { id: 4, name: "Rynek Główny", step: "Na Rynku skręć w prawo, cel po lewej.", length: 250, facts: "płyty · 0 stopni", source: "OSM · 05.2026", points: [[600, 470], [570, 520], [545, 585]] },
    ],
  },
]

export function segmentStatus(seg: Segment, profile: Profile | null, th: Thresholds | null): { status: Status; note: string } {
  if (seg.unknown) return { status: "unknown", note: seg.facts }
  if (seg.stairs) {
    if (profile === "stroller" && seg.strollerRamp) return { status: "met", note: `${seg.stairs} schody z rampą` }
    return { status: "barrier", note: `${seg.stairs} schody` }
  }
  if (seg.curbCm !== undefined && th && seg.curbCm > th.maxThreshold) {
    return { status: "barrier", note: `krawężnik ${seg.curbCm} cm` }
  }
  return { status: "met", note: seg.facts }
}

export function routeSummary(route: Route, profile: Profile | null, th: Thresholds | null) {
  const segs = route.segments.map((s) => ({ seg: s, ...segmentStatus(s, profile, th) }))
  const barriers = segs.filter((s) => s.status === "barrier")
  const unknown = segs.filter((s) => s.status === "unknown")
  return { segs, barriers, unknownCount: unknown.length, unknownMeters: unknown.reduce((a, s) => a + s.seg.length, 0) }
}
