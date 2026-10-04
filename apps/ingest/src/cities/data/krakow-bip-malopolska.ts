import type { PageLicense, SourcePage } from "../types";

const declaration = (unit: string) => `https://bip.malopolska.pl/${unit},e,deklaracja.html`;
const OPEN_DATA_ACT = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20210001641";

/**
 * Reuse terms of a publisher the open data act applies to (an office, a museum, a library, an archive): information
 * in its BIP is reused without a request; the user names the source and the time it was created and obtained, and
 * says it was processed. `terms` says what the publisher's own BIP adds, if anything.
 */
const openData = (terms: string, termsUrl = OPEN_DATA_ACT): PageLicense => ({ confirmed: true, terms, termsUrl });

/**
 * The act does not apply to cultural institutions other than museums and libraries, nor to universities (art. 4),
 * and their BIP states no reuse terms: to confirm with the institution before anything is fetched.
 */
const toConfirm: PageLicense = {
  confirmed: false,
  terms:
    "Instytucja kultury inna niż muzeum lub biblioteka — ustawa o otwartych danych nie ma zastosowania (art. 4), " +
    "a BIP nie podaje warunków ponownego wykorzystywania: do potwierdzenia z instytucją",
};

/**
 * Accessibility declarations of public bodies in Kraków published in the Małopolska regional BIP, read through its
 * API (`<api>/contexts/<unit>/accessibility-declaration`). A declaration about several buildings lists one place per
 * building with the sentences about it (`sections`, matched sentence by sentence). Coordinates are those of the OSM
 * object in `osmRef`. Wawel, Muzeum Narodowe, Muzeum Lotnictwa and Manggha are left out: their declaration here is
 * only headings or absent.
 */
export const krakowBipMalopolskaPages: SourcePage[] = [
  {
    url: declaration("muw"),
    license: openData(
      "MUW: ponowne wykorzystywanie informacji z BIP bez wniosku (wniosek tylko dla informacji spoza BIP), bez odrębnych warunków",
      "https://bip.malopolska.pl/muw,a,34780,przekazanie-informacji-sektora-publicznego-na-wniosek-o-ponowne-wykorzystywanie-informacji-sektora-p.html",
    ),
    places: [
      {
        id: "basztowa-22",
        name: "Małopolski Urząd Wojewódzki – Basztowa 22",
        category: "other",
        location: { x: 19.94352, y: 50.065519 },
        street: "Basztowa",
        houseNumber: "22",
        osmRef: "osm:way/167351784",
        sections: [{ from: "Budynek przy ul. Basztowej 22", to: "Budynek przy ul. Worcella 7" }],
      },
      {
        id: "przy-rondzie-6",
        name: "Małopolski Urząd Wojewódzki – Wydział Spraw Cudzoziemców",
        category: "other",
        location: { x: 19.961184, y: 50.062714 },
        street: "Przy Rondzie",
        houseNumber: "6",
        osmRef: "osm:way/154353710",
        sections: [{ from: "Budynek przy ul. Przy Rondzie 6", to: "Budynek przy ul. św. Sebastiana 9" }],
      },
      {
        id: "sebastiana-9",
        name: "Małopolski Urząd Wojewódzki – Wydział Spraw Obywatelskich (Sebastiana 9)",
        category: "other",
        location: { x: 19.941533, y: 50.055537 },
        street: "Świętego Sebastiana",
        houseNumber: "9",
        osmRef: "osm:node/13645479501",
        sections: [{ from: "Budynek przy ul. św. Sebastiana 9", to: "Budynek przy ul. św. Sebastiana 11" }],
      },
      {
        id: "sebastiana-11",
        name: "Małopolski Urząd Wojewódzki – Wydział Spraw Obywatelskich (Sebastiana 11)",
        category: "other",
        location: { x: 19.941803, y: 50.055512 },
        street: "Świętego Sebastiana",
        houseNumber: "11",
        osmRef: "osm:node/2985262563",
        sections: [{ from: "Budynek przy ul. św. Sebastiana 11", to: "Budynki przy ul. Półlanki" }],
      },
    ],
  },
  {
    url: declaration("wbpwkrakowie"),
    license: openData("Biblioteka publiczna; BIP nie określa odrębnych warunków ponownego wykorzystywania"),
    places: [
      {
        id: "rajska-1",
        name: "Wojewódzka Biblioteka Publiczna w Krakowie",
        category: "other",
        location: { x: 19.9296, y: 50.064965 },
        street: "Rajska",
        houseNumber: "1",
        osmRef: "osm:way/29327226",
        sections: [{ from: "Budynek Główny WBP", to: "Arteteka" }],
      },
    ],
  },
  {
    url: declaration("pbwwkrakowie"),
    license: openData("Biblioteka pedagogiczna; BIP nie określa odrębnych warunków ponownego wykorzystywania"),
    places: [
      {
        id: "focha-39",
        name: "Pedagogiczna Biblioteka Wojewódzka im. Hugona Kołłątaja",
        category: "other",
        location: { x: 19.91216, y: 50.056904 },
        street: "Aleja Marszałka Ferdinanda Focha",
        houseNumber: "39",
        osmRef: "osm:way/233092514",
        sections: [{ from: "Focha 39", to: "Filia w Chrzanowie" }],
      },
    ],
  },
  {
    url: declaration("ankrakow"),
    license: openData(
      "Archiwum państwowe: zasób dostępny do ponownego wykorzystywania bez warunków; informacje z BIP bez odrębnych warunków",
      "https://bip.malopolska.pl/ankrakow,a,1209726,ponowne-wykorzystywanie-informacji-sektora-publicznego.html",
    ),
    places: [
      {
        id: "rakowicka-22e",
        name: "Archiwum Narodowe w Krakowie",
        category: "other",
        location: { x: 19.95143, y: 50.072821 },
        street: "Rakowicka",
        houseNumber: "22E",
        osmRef: "osm:way/693614255",
        sections: [{ from: "Kraków, ul. Rakowicka 22E", to: "Oddział w Nowym Sączu" }],
      },
    ],
  },
  {
    url: declaration("kokrakow"),
    license: openData(
      "Kuratorium: wniosek tylko dla informacji spoza BIP; informacje z BIP bez odrębnych warunków",
      "https://bip.malopolska.pl/kokrakow,a,1890045,przekazanie-informacji-sektora-publicznego-na-wniosek-o-ponowne-wykorzystywanie-informacji-sektora-p.html",
    ),
    places: [
      {
        id: "szlak-73",
        name: "Kuratorium Oświaty w Krakowie",
        category: "other",
        location: { x: 19.943235, y: 50.070342 },
        street: "Szlak",
        houseNumber: "73",
        osmRef: "osm:way/152980045",
        sections: [{ from: "Kraków, ul. Szlak 73", to: "Kraków, ul. Mazowiecka 25" }],
      },
    ],
  },
  {
    url: declaration("mawkrakowie"),
    license: openData("Muzeum samorządowe; BIP nie określa odrębnych warunków ponownego wykorzystywania"),
    places: [
      {
        id: "senacka-3",
        name: "Muzeum Archeologiczne w Krakowie",
        category: "museum",
        location: { x: 19.936255, y: 50.057556 },
        street: "Senacka",
        houseNumber: "3",
        osmRef: "osm:relation/1863002",
        // The list of sites at the top, then the main building's own part; the church crypt and Branice are other sites.
        sections: [
          { from: "Gmach Główny Muzeum - ul. Senacka 3", to: "podziemia Kościół św. Wojciecha" },
          { from: "GMACH GŁÓWNY – ULICA SENACKA 3" },
        ],
      },
    ],
  },
  {
    url: declaration("meisuwkrakowie"),
    license: openData(
      "Muzeum: informacje z BIP do ponownego wykorzystywania w celach komercyjnych i niekomercyjnych",
      "https://bip.malopolska.pl/meisuwkrakowie,a,2699061,ponowne-wykorzystywanie-informacji-sektora-publicznego.html",
    ),
    places: [
      {
        id: "ratusz",
        name: "Muzeum Etnograficzne – Ratusz",
        category: "museum",
        location: { x: 19.943485, y: 50.048662 },
        street: "Plac Wolnica",
        houseNumber: "1",
        osmRef: "osm:node/472147202",
        sections: [{ from: "Muzeum Etnograficzne, Ratusz, pl. Wolnica 1", to: "Muzeum Etnograficzne, Dom Esterki" }],
      },
      {
        id: "dom-esterki",
        name: "Muzeum Etnograficzne – Dom Esterki",
        category: "museum",
        location: { x: 19.94383, y: 50.04776 },
        street: "Krakowska",
        houseNumber: "46",
        osmRef: "osm:way/152137708",
        sections: [{ from: "Muzeum Etnograficzne, Dom Esterki" }],
      },
    ],
  },
  {
    url: declaration("okrakowska"),
    license: toConfirm,
    places: [
      {
        id: "lubicz-48",
        name: "Opera Krakowska",
        category: "theatre",
        location: { x: 19.956168, y: 50.065917 },
        street: "Lubicz",
        houseNumber: "48",
        osmRef: "osm:way/128130589",
        sections: [{ from: "GMACH GŁÓWNY OPERY", to: "BUDYNEK ADMINISTRACJI" }],
      },
    ],
  },
  {
    url: declaration("tslowackiego"),
    license: toConfirm,
    places: [
      {
        id: "plac-swietego-ducha-1",
        name: "Teatr im. Juliusza Słowackiego",
        category: "theatre",
        location: { x: 19.943049, y: 50.063946 },
        street: "Plac Świętego Ducha",
        houseNumber: "1",
        osmRef: "osm:way/153942974",
      },
    ],
  },
];
