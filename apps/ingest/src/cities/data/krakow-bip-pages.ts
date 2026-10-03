import type { SourcePage } from "../types";

const page = (mmi: number) => `https://www.bip.krakow.pl/?mmi=${mmi}`;

/**
 * "Dostępność architektoniczna" pages of Kraków's cultural institutions on BIP MK, found from each
 * unit's "Deklaracja dostępności" (`#a11y-architektura-url`). A page describing several buildings
 * lists one place per building with the sections about it. Coordinates are those of the OSM object
 * in `osmRef`. Muzeum Krakowa and Teatr Variete publish only a PDF / one line, so they are not here.
 */
export const krakowBipPages: SourcePage[] = [
  {
    url: page(19180),
    places: [
      {
        id: "zajezdnia",
        name: "Muzeum Inżynierii i Techniki",
        category: "museum",
        location: { x: 19.947297, y: 50.049513 },
        street: "Świętego Wawrzyńca",
        houseNumber: "15",
        osmRef: "osm:way/638349014",
        // The visitor route through building D and the site-wide summaries; the exhibition halls
        // E/H/L and the office building B have no lift or accessible toilet of their own.
        sections: [
          { from: "1. Siedziba Muzeum", to: "Budynek E" },
          { from: "Dostępność korytarzy, schodów i wind", to: "2. Oddział I" },
        ],
      },
      {
        id: "hangar-czyzyny",
        name: "Hangar Czyżyny – Muzeum Inżynierii i Techniki",
        category: "museum",
        location: { x: 20.001997, y: 50.077879 },
        street: "os. 2 Pułku Lotniczego",
        houseNumber: "26a",
        osmRef: "osm:way/83334224",
        sections: [{ from: "3. Oddział II" }],
      },
    ],
  },
  {
    url: page(19181),
    places: [
      {
        id: "rakowicka",
        name: "MuFo Rakowicka",
        category: "museum",
        location: { x: 19.953532, y: 50.070403 },
        street: "Rakowicka",
        houseNumber: "22A",
        osmRef: "osm:way/1025803982",
        sections: [{ from: "MuFo Rakowicka, ul. Rakowicka", to: "MuFo Józefitów, ul. Józefitów" }],
      },
      {
        id: "jozefitow",
        name: "MuFo Józefitów",
        category: "museum",
        location: { x: 19.92364, y: 50.069993 },
        street: "Józefitów",
        houseNumber: "16",
        osmRef: "osm:node/9455645942",
        sections: [{ from: "MuFo Józefitów, ul. Józefitów" }],
      },
    ],
  },
  {
    url: page(19182),
    places: [
      {
        id: "bunkier-sztuki",
        name: "Bunkier Sztuki",
        category: "museum",
        location: { x: 19.934447, y: 50.063581 },
        street: "Plac Szczepański",
        houseNumber: "3a",
        osmRef: "osm:node/475387282",
      },
    ],
  },
  {
    url: page(19179),
    places: [
      {
        id: "muzeum-ak",
        name: "Muzeum Armii Krajowej",
        category: "museum",
        location: { x: 19.948707, y: 50.072389 },
        street: "Wita Stwosza",
        houseNumber: "12",
        osmRef: "osm:relation/1765210",
      },
    ],
  },
  {
    url: page(21534),
    places: [
      {
        id: "mocak",
        name: "Muzeum Sztuki Współczesnej w Krakowie MOCAK",
        category: "museum",
        location: { x: 19.961212, y: 50.047779 },
        street: "Lipowa",
        houseNumber: "4",
        osmRef: "osm:way/153173384",
        // Building A is the museum; building B and Galeria Re are described separately.
        sections: [{ from: "Budynek główny (A)", to: "Budynek B" }],
      },
    ],
  },
  {
    url: page(24812),
    places: [
      {
        id: "kl-plaszow",
        name: "Muzeum – Miejsce Pamięci KL Plaszow",
        category: "museum",
        location: { x: 19.960453, y: 50.047099 },
        street: "Lipowa",
        houseNumber: "3",
        osmRef: "osm:node/5607450892",
      },
    ],
  },
  {
    url: page(20442),
    places: [
      {
        id: "groteska",
        name: "Teatr Groteska",
        category: "theatre",
        location: { x: 19.926585, y: 50.063188 },
        street: "Skarbowa",
        houseNumber: "2",
        osmRef: "osm:node/471984833",
      },
    ],
  },
  {
    url: page(20443),
    places: [
      {
        id: "karmelicka",
        name: "Teatr Bagatela",
        category: "theatre",
        location: { x: 19.932269, y: 50.06365 },
        street: "Karmelicka",
        houseNumber: "6",
        osmRef: "osm:way/125207200",
      },
    ],
  },
  {
    url: page(20444),
    places: [
      {
        id: "laznia-nowa",
        name: "Teatr Łaźnia Nowa",
        category: "theatre",
        location: { x: 20.047957, y: 50.07819 },
        street: "os. Szkolne",
        houseNumber: "25",
        osmRef: "osm:node/968080333",
        sections: [{ from: "TEATR ŁAŹNIA NOWA", to: "DOM UTOPII" }],
      },
      {
        id: "dom-utopii",
        name: "Dom Utopii – Teatr Łaźnia Nowa",
        category: "other",
        location: { x: 20.049149, y: 50.077817 },
        street: "os. Szkolne",
        houseNumber: "26A",
        osmRef: "osm:way/83198161",
        sections: [{ from: "DOM UTOPII", to: "W Teatrze Łaźnia Nowa oraz w Domu Utopii" }],
      },
    ],
  },
  {
    url: page(20445),
    places: [
      {
        id: "kto",
        name: "Teatr KTO",
        category: "theatre",
        location: { x: 19.944023, y: 50.040482 },
        street: "Jana Zamoyskiego",
        houseNumber: "50",
        osmRef: "osm:relation/21094621",
      },
    ],
  },
  {
    url: page(20431),
    places: [
      {
        id: "duza-scena",
        name: "Teatr Ludowy",
        category: "theatre",
        location: { x: 20.033752, y: 50.080364 },
        street: "os. Teatralne",
        houseNumber: "34",
        osmRef: "osm:way/39449007",
        sections: [{ from: "Duża Scena - os. Teatralne 34", to: "Teatralny Instytut Młodych - os. Teatralne 23" }],
      },
      {
        id: "teatralny-instytut-mlodych",
        name: "Teatralny Instytut Młodych",
        category: "theatre",
        location: { x: 20.032184, y: 50.080192 },
        street: "os. Teatralne",
        houseNumber: "23",
        osmRef: "osm:way/172741052",
        sections: [{ from: "Teatralny Instytut Młodych - os. Teatralne 23", to: "Scena Pod Ratuszem - Rynek Główny 1" }],
      },
    ],
  },
  {
    url: page(21592),
    places: [
      {
        id: "scena-stu",
        name: "Teatr Scena STU",
        category: "theatre",
        location: { x: 19.926443, y: 50.056413 },
        street: "Aleja Zygmunta Krasińskiego",
        houseNumber: "16-18",
        osmRef: "osm:node/2611212705",
      },
    ],
  },
  {
    url: page(21591),
    places: [
      {
        id: "willa-decjusza",
        name: "Willa Decjusza",
        category: "other",
        location: { x: 19.871549, y: 50.063648 },
        street: "28 Lipca 1943",
        houseNumber: "17a",
        osmRef: "osm:way/232081937",
      },
    ],
  },
  {
    url: page(20437),
    places: [
      {
        id: "dworek-bialopradnicki",
        name: "Dworek Białoprądnicki",
        category: "other",
        location: { x: 19.94092, y: 50.092828 },
        street: "Papiernicza",
        houseNumber: "2",
        osmRef: "osm:way/30825094",
        // The page goes topic by topic, each listing all nine locations: one section per topic.
        sections: [
          { from: "Dworek Białoprądnicki:", to: "Zajazd Kościuszkowski" },
          { from: "Dworek Białoprądnicki:", to: "Zajazd Kościuszkowski" },
          { from: "Dworek Białoprądnicki:", to: "Zajazd Kościuszkowski" },
          { from: "Dworek Białoprądnicki:", to: "Zajazd Kościuszkowski" },
        ],
      },
    ],
  },
  {
    url: page(20432),
    places: [
      {
        id: "osiedle-gorali-5",
        name: "Ośrodek Kultury im. C. K. Norwida",
        category: "other",
        location: { x: 20.036497, y: 50.079742 },
        street: "os. Górali",
        houseNumber: "5",
        osmRef: "osm:node/968360641",
        sections: [{ from: "osiedle Górali 5", to: "Budynek ARTzona" }],
      },
    ],
  },
  {
    url: page(20436),
    places: [
      {
        id: "nck",
        name: "Nowohuckie Centrum Kultury",
        category: "other",
        location: { x: 20.034841, y: 50.070769 },
        street: "al. Jana Pawła II",
        houseNumber: "232",
        osmRef: "osm:way/39449013",
      },
    ],
  },
  {
    url: page(30688),
    places: [
      {
        id: "sokolska-13",
        name: "Centrum Kultury Podgórza",
        category: "other",
        location: { x: 19.945602, y: 50.044395 },
        street: "Sokolska",
        houseNumber: "13",
        osmRef: "osm:way/136650633",
        sections: [{ from: "1. Siedziba Główna (ul. Sokolska 13)", to: "2. Centrum Sztuki Współczesnej Solvay" }],
      },
    ],
  },
  {
    url: page(18146),
    places: [
      {
        id: "wietora",
        name: "Staromiejskie Centrum Kultury Młodzieży",
        category: "other",
        location: { x: 19.941098, y: 50.046261 },
        street: "Hieronima Wietora",
        houseNumber: "13-15",
        osmRef: "osm:node/1939118344",
      },
    ],
  },
  {
    url: page(21557),
    places: [
      {
        id: "biblioteka-glowna",
        name: "Biblioteka Kraków – Biblioteka Główna",
        category: "other",
        location: { x: 19.9296, y: 50.051995 },
        street: "Powroźnicza",
        houseNumber: "2",
        osmRef: "osm:node/1506803153",
        sections: [{ from: "Biblioteka Główna, ul. Powroźnicza 2", to: "Filia nr 1," }],
      },
    ],
  },
];
