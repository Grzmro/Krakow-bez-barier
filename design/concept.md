# Koncepcja FINALNA: „Druga strona”

Kraków bez barier · HackYeah 2026 · mobile 390×844 · kierunek wizualny B „Fiolet” · grupa „na kółkach”
(Wózek + Wózek dziecięcy) · stack: Next.js + MapLibre (`react-map-gl/maplibre`); UI w 2 wariantach do porównania:
**A** MUI v9 z własnym motywem, **B** shadcn/ui (Radix + Tailwind v4) + Vaul + Sonner. Spec ekranów jest niezależny od biblioteki.

> **Dane w tym dokumencie.** Każda nazwa miejsca, liczba, data i trasa w makietach i w sekcji 7 to
> **PRZYKŁAD**. W prototypie każda karta, fakt i trasa z tego zbioru ma widoczny tag `PRZYKŁAD`.
> Dwa elementy są realne i można je pokazać jako realne: host `msip3.um.krakow.pl` zwraca 404
> (research-data-sources.md, §8), a OSM ma w Krakowie 722 schody z `ramp:stroller`.

---

## 0. Werdykt krytyka (skrót)

Żadna z koncepcji nie przechodzi w obecnej formie. Koncepcja 1 jest najlepsza dla jury i najgorsza do
zbudowania. Koncepcja 2 ma lepszy start i lepszy wow, ale obiecuje treści (zdjęcia, gęste werdykty
„Pasuje · 38”), których otwarte dane nie mają. **Łączymy:** start i wow z Koncepcji 2, mapę z listą i
wątek źródeł z Koncepcji 1. Wycinamy 3-stanowy arkusz, scrub, karuzele, 3D-flip setek pinów, home
z sekcjami i osobny ekran profilu.

---

## 1. Krytyka z 4 perspektyw

### 1.1 Koncepcja 1 „Mapa z drugą stroną” (map-first)

**(a) Osoba na wózku, na ulicy, telefon w jednej ręce: 5/10**
- Plus: 1 tap do wartości, werdykt w peek, liczby zamiast zdań.
- Minus: przełącznik „Skąd wiemy?” i awatar profilu leżą w **górnym prawym rogu**, czyli poza zasięgiem
  kciuka, gdy druga ręka jest na obręczy.
- Minus: arkusz z 3 wysokościami + pan/zoom mapy + scrub po pasku 4 mm wysokości to trzy precyzyjne gesty.
  Na nierównej kostce i w słońcu to się nie uda.
- Minus: system statusów ma **8 stanów** (4 kształty × pełne/kontur). „Kontur = niepewne” jest nieczytelne
  w słońcu i na projektorze. To legenda, której nikt nie przeczyta.
- Minus: Ekran 4 (full) to ściana: 12 wierszy, 2 poziomy zagnieżdżenia. To dokładnie zarzut wobec
  odrzuconego prototypu.

**(b) Rodzic z wózkiem, turysta: 5/10**
- Minus: mapa z kropkami nie mówi, *dokąd warto iść* (autor sam to przyznaje). Turysta nie zna nazw.
- Plus: przeliczenie trasy dla `ramp:stroller` to najlepszy moment dla tej grupy i jest oparty na realnych danych.

**(c) Jury, R1–R8 + porażki + biznes w 3 minuty: 8/10**
- Plus: najpełniejsze pokrycie. Prawdziwa awaria (404), konflikt ZIW vs OSM, stare dane, widget hotelu,
  lista jako tekst mapy (R6), „Twój limit: 2 cm” (R4).
- Minus: 9 ekranów i 8 przejść w 3 minuty to za dużo. Jury nie zdąży zrozumieć legendy pinów.
- Minus: wow (flip pinów) wygląda świetnie, ale komunikuje R2/R3, a nie główny scenariusz grupy.

**(d) Zespół, ~20 h, Next.js + MUI/shadcn + MapLibre: 3/10**
- 3-stanowy arkusz ze sprężyną na webie: MUI nie ma snap pointów (Vaul w wariancie shadcn ma, ale 3 stany +
  synchronizacja z mapą to i tak 3–5 h z błędami na iOS Safari).
- Flip setek pinów w MapLibre: warstwy symboli nie mają 3D-transformacji, a markery HTML przy setkach
  punktów zabijają płynność. **Fake feasibility.**
- Scrub zsynchronizowany z punktem jadącym po linii, routing z barierami per odcinek i monitoring
  zdrowia źródeł na żywo to trzy osobne projekty.
- Autor sam pisze, że plan B to „ładna mapa z kropkami”.

### 1.2 Koncepcja 2 „Dla Ciebie” (card-first)

**(a) Osoba na wózku, jedna ręka: 6/10**
- Plus: werdykt napisany słowami na karcie, bez legendy. Cele duże.
- Minus: home ma 4 sekcje i 2 karuzele poziome. Przewijanie w dwóch osiach jedną ręką jest męczące.
- Minus: odwrócenie karty to **long-press** albo mała ikona ⟲ w rogu, czyli ukryty gest.
- Minus: brak mapy w głównym widoku. Na ulicy pytanie brzmi „co jest *tu*”, a nie „co polecacie”.

**(b) Rodzic z wózkiem, turysta: 7/10**
- Plus: discovery, sekcje „Muzea / Kawa”, ton Airbnb. Najlepiej odpowiada na „gdzie pójść”.
- Minus: karty żyją ze zdjęć, a otwarte dane prawie ich nie mają. Bez zdjęć to zwykła lista.

**(c) Jury: 7/10**
- Plus: wow „ten sam Kraków, inna osoba” (przełączenie profilu, liczniki 12 → 15) w 3 sekundy pokazuje R4.
- Plus: „Twoja granica w nawiasie” (110 cm (≥80)) to najlepszy detal obu koncepcji.
- Minus: **„Pasuje do Ciebie · 38”** na home sugeruje gęstość danych, której nie ma (~9% POI w OSM ma
  `wheelchair`). Jury sprawdza pochodzenie każdej liczby i zobaczy wszędzie PRZYKŁAD.
- Minus: „Pasuje do Ciebie” brzmi jak gwarancja, przed czym wyzwanie wprost ostrzega.
- Minus: 10 ekranów, z czego E8 (profil) i E10 (widget) dublują logikę.

**(d) Zespół, ~20 h: 5/10**
- Plus: listy i karty są tanie w każdej bibliotece UI. Mapa jako tryb drugorzędny obniża ryzyko.
- Minus: 3D-flip kart + stagger + FLIP-resort + animowane cyfry + karuzela zsynchronizowana z pinami to
  dużo choreografii. Zdjęcia wymagają licencji i atrybucji.
- Minus: ekran trasy też potrzebuje routingu z odcinkami, więc ryzyko jest to samo co w Koncepcji 1.

### 1.3 Tabela ocen

| Perspektywa | K1 Map-first | K2 Card-first | **FINAL** |
|---|---|---|---|
| (a) Wózek, ulica, jedna ręka | 5 | 6 | **8** |
| (b) Rodzic z wózkiem, turysta | 5 | 7 | **7** |
| (c) Jury R1–R8 w 3 min | 8 | 7 | **9** |
| (d) Zespół 20 h | 3 | 5 | **7** |
| **Średnia** | **5,25** | **6,25** | **7,75** |

### 1.4 Wspólne grzechy obu koncepcji

1. **Za dużo ekranów** (9 i 10). Demo ma 3 minuty, więc pokażemy najwyżej 7.
2. **Gesty bez przycisków.** Każdy gest musi mieć przycisk (R6). Skoro i tak budujemy przycisk, gest jest opcjonalny.
3. **Animacje jako rdzeń wow.** Wow ma działać nawet z `prefers-reduced-motion` (wtedy to przenikanie).
4. **Za dużo słów-etykiet zaufania.** K1: pełne/kontur. K2: 5 modyfikatorów. Zostawiamy 3 poziomy
   + 2 flagi, pokazywane **tylko na drugiej stronie**.

---

## 2. Koncepcja finalna w 4 zdaniach

1. **Jedno pytanie** („Czym się poruszasz?”, 2 kafelki), a potem od razu **mapa z listą**: mapa na górze,
   pod nią arkusz o **2 wysokościach** z tymi samymi miejscami jako krótkie karty z werdyktem.
2. **Werdykt osobisty zawsze z liczbą** („Pasuje · 4/4”, „Bariera · 3 stopnie”), a w szczegółach
   **Twoja granica w nawiasie** („Drzwi 110 cm (min. 80)”).
3. **Każde miejsce ma drugą stronę.** Przycisk „Skąd wiemy?” w zasięgu kciuka odwraca kartę i pokazuje
   źródło, datę i pewność każdego faktu, konflikt dwóch źródeł obok siebie, stare dane i źródło offline.
4. **Wow: „Ten sam Kraków, inna osoba”.** Przełącznik profilu w dolnej części ekranu przelicza piny,
   liczniki i trasę na oczach jury. Trasa to pionowa lista odcinków (tekst = mapa, R6), a model biznesowy
   to ta sama karta osadzona na stronie hotelu.

**Puenta pitchu:** *„Każde miejsce ma drugą stronę. Z przodu: czy to dla Ciebie. Z tyłu: skąd to wiemy.”*

### Co wzięliśmy, a co wycięliśmy

| Wzięte | Skąd | Wycięte | Dlaczego |
|---|---|---|---|
| Jedno pytanie, 2 kafelki, bez „Dalej” | K1 + K2 | Home z sekcjami i karuzelami | Pusty przy rzadkich danych, 2 osie przewijania |
| Mapa + lista w jednym widoku | K1 (lista = R6) | Arkusz 3-stanowy | Kosztowny, gestowy. 2 stany + przycisk wystarczą |
| Liczniki statusów jako filtry | K2 E3 | 8 stanów pinów (pełne/kontur) | Legenda nie do przeczytania |
| Twoja granica w nawiasie | K2 E5 + K1 „Twój limit” | Scrub po pasku barier | Precyzyjny gest, dużo kodu. Tap w odcinek wystarczy |
| Druga strona = źródła | K1 + K2 | Flip setek pinów | Niewykonalne płynnie w MapLibre na real data |
| Konflikt obok siebie + „Byłeś tu?” | K1 E4 + K2 E4 | Osobny ekran profilu (E8) | Przełącznik profilu jest w arkuszu. Progi = P2 |
| Korekta ≤ 3 tapy, chipy z wartościami | K1 E5 + K2 E9 | Karuzela kart odcinków | Pionowa lista jest czytelna dla czytnika |
| Przełączenie profilu jako wow | K2 E3 | Zdjęcia jako fundament karty | Brak legalnych zdjęć. Fallback: wycinek mapy |
| Widget hotelu | K1 E9 + K2 E10 | Mapa źródeł (flip mapy) jako osobny ekran | Stan źródeł mieści się w banerze i w arkuszu na ekr. 4 |

---

## 3. Design tokens (kierunek B „Fiolet”, finalne)

### 3.1 Kolory

| Token | Light | Dark | Użycie |
|---|---|---|---|
| `primary.main` | `#5B3DF5` | `#A99BFF` | Jedyne wypełnione CTA na ekranie, aktywny chip/segment, linia trasy, wybrany pin, fokus |
| `primary.dark` | `#4A2FE0` | `#7C68FF` | Hover / pressed |
| `primary.light` (container) | `#EDE9FF` | `#2A2440` | Tło aktywnego chipa, zaznaczenia |
| `secondary.main` (blush) | `#FFB8D9` | `#FF9CCB` | Tylko „radość”: ilustracje startu, toast „Dzięki!”. **Nigdy przy statusie** |
| `secondary.light` | `#FFD6E8` | — | Tło toastu „Dzięki!” |
| `background.default` | `#FAF8F5` | `#0F0D16` | Tło aplikacji |
| `background.paper` | `#FFFFFF` | `#1A1724` | Karty, arkusze |
| `surfaceRaised` | `#FFFFFF` + cień | `#2A2440` | Karty w arkuszu |
| `text.primary` (ink) | `#16141F` | `#F3F1F8` | Tekst |
| `text.secondary` | `#625E70` | `#ABA6BA` | Tekst wtórny, caption |
| `borderStrong` | `#8E8A9A` | `#6E6982` | Granice kontrolek (≥ 3:1) |
| `divider` | `#ECE8E3` | `#2A2440` | Tylko dekoracja |

### 3.2 System statusów (osobny od marki, zawsze ikona + kształt + słowo + kolor)

| Status | Słowo | Ikona Phosphor (Fill) | Kształt pinu / badge | Light tekst / tło | Dark tekst / tło |
|---|---|---|---|---|---|
| `met` | **Pasuje** | `CheckCircle` | koło | `#1E7B4F` / `#E6F4EC` | `#5FD39A` / `#12261C` |
| `barrier` | **Bariera** | `Prohibit` | ośmiokąt | `#C42B1C` / `#FCE9E7` | `#FF8A7A` / `#2E1512` |
| `conflict` | **Sprzeczne** | `WarningDiamond` | romb | `#9A5A00` / `#FFF3DC` | `#FFC15C` / `#2B2010` |
| `unknown` | **Brak danych** | `Question` (Regular) | koło, **obrys przerywany 1.5 px** | `#5B6270` / `#EEF0F3` | `#AEB4C0` / `#22252C` |

**Reguła werdyktu miejsca** (pure function `matchVerdict`, z testami):
bariera (którakolwiek potrzeba) → Bariera; inaczej konflikt → Sprzeczne; inaczej nieznane → Brak danych;
dopiero gdy wszystkie potrzeby znane i spełnione → Pasuje. **Szary nigdy nie staje się zielony.**

**Tekst badge'a = słowo + powód z liczbą:**
`Pasuje · 4/4` · `Bariera · 3 stopnie` · `Sprzeczne · toaleta` · `Brak danych · 2 z 4`.

**Pewność (tylko na drugiej stronie, nigdy nie zmienia koloru werdyktu):**

| Poziom | Słowo | Ikona |
|---|---|---|
| oficjalne / zarządca | **Potwierdzone** | `ShieldCheck` |
| OSM | **Społeczność** | `UsersThree` |
| zgłoszenie | **Zgłoszenie** | `ChatCircleDots` |

Flagi dodatkowe: `ClockCounterClockwise` + „3 lata” (stare dane) · `CloudSlash` + „Kopia z 1.10” (źródło offline) ·
tag `PRZYKŁAD` (dane przykładowe).

**Tag PRZYKŁAD:** Inter 11/600, wersaliki, tracking +4%, obrys 1 px `#16141F` 40% (dark: `#F3F1F8` 40%),
tło przezroczyste, radius 6, wysokość 20. Stoi w prawym górnym rogu karty i obok każdej wartości przykładowej.
`aria-label="Dane przykładowe"`.

### 3.3 Typografia

| Rola | Font | Rozmiar / linia / waga | Tracking |
|---|---|---|---|
| display | Manrope | 32/38 · 800 | −2% |
| h1 | Manrope | 28/34 · 700 | −1,5% |
| h2 | Manrope | 22/28 · 700 | −1% |
| title | Inter | 18/24 · 600 | 0 |
| body | Inter | 17/24 · 400 | 0 |
| body-sm | Inter | 15/22 · 400 | 0 |
| label / button | Inter | 15/20 · 600 (button 16) | 0 |
| caption | Inter | 13/18 · 500 | 0 |
| **liczby w werdyktach i czasach** | Manrope | jak rola, 800, `tabular-nums` | −1% |

Inter z `font-feature-settings: "cv05", "ss01"` (rozróżnienie l/I/1; sprawdzić kody w dokumentacji Inter).
Fonty self-host: `@fontsource/manrope`, `@fontsource-variable/inter`.

### 3.4 Kształt, przestrzeń, cień, ruch

- **Spacing (baza 4):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56. Margines ekranu 16.
- **Radius:** input / mała karta 12 · karta 20 · bottom sheet **24** (górne rogi) · chip i przycisk pill (999) · tag 6.
- **Cień (light):** `0 1px 2px rgba(22,20,31,.06), 0 6px 20px rgba(91,61,245,.10)`. Dark: bez cieni,
  powierzchnia `#2A2440` + obrys 1 px `#2A2440`.
- **Cele dotykowe:** min. 48×48. Główne CTA 56 wysokości.
- **Fokus:** obrys 3 px `primary` + offset 2 px.
- **Ruch:** 200–300 ms, `cubic-bezier(.2,.8,.2,1)`. Flip karty: rotateY 180°, 300 ms. Przeliczenie liczników:
  count-up 400 ms. `prefers-reduced-motion`: wszystko → przenikanie 150 ms.
- **Strefa kciuka:** wszystkie akcje główne (CTA, przełącznik profilu, „Skąd wiemy?”) leżą w dolnych 40% ekranu
  (y ≥ 500). Na górze tylko wyszukiwarka i „wstecz”.

### 3.5 Mapa

Styl bazowy jasny, ciepło-szary, bez kolorowych POI (np. OpenFreeMap „positron” przyciemniony do ciepłej szarości,
dark: „dark matter”). Linia trasy 6 px `#5B3DF5` z białym obrysem 2 px. Odcinek bez danych: linia **przerywana
szara** `#5B6270`, nigdy fioletowa ciągła. Atrybucja „© OpenStreetMap” zawsze widoczna nad arkuszem.
Piny: `StatusPin` 36 px (cel dotyku 48) jako marker HTML (zbiór demo ≤ 20 miejsc). Wybrany pin: 48 px + ring 3 px fiolet.

### 3.6 Ikony (Phosphor, `@phosphor-icons/react`)

Regular w UI, Fill w statusach i aktywnych elementach, Bold w pinach. Nazwy do sprawdzenia w katalogu
phosphoricons.com; w razie braku użyć zamiennika z nawiasu.

| Znaczenie | Ikona |
|---|---|
| Profil: wózek / wózek dziecięcy | `Wheelchair` / `BabyCarriage` |
| Wyszukaj / wstecz / zamknij | `MagnifyingGlass` / `CaretLeft` / `X` |
| Mapa / lista | `MapTrifold` / `ListBullets` |
| Druga strona („Skąd wiemy?”) | `ArrowsCounterClockwise` |
| Prowadź / trasa / zamiana | `NavigationArrow` / `Path` / `ArrowsDownUp` |
| Stopnie / próg | `Stairs` (zamiennik: `ArrowElbowRightUp`) |
| Drzwi (szerokość) | `ArrowsHorizontal` |
| Winda / toaleta / przewijak | `Elevator` / `Toilet` / `Baby` |
| Nawierzchnia (kostka) / nachylenie / krawężnik | `GridFour` / `TrendUp` / `Ruler` |
| Źródło / data | `Database` / `CalendarBlank` |
| Pewność | `ShieldCheck` / `UsersThree` / `ChatCircleDots` |
| Stare / offline | `ClockCounterClockwise` / `CloudSlash` |
| Link zewnętrzny / aparat | `ArrowSquareOut` / `Camera` |
| Hotel / dworzec / lokalizacja | `Bed` / `Train` / `Crosshair` |
| Kategorie: muzeum / kawa | `Bank` / `Coffee` |

---

## 4. Ekrany (7). Kolejność = kolejność demo

Legenda ASCII: `▓` mapa, `░` wycinek/obraz, `●` fiolet (CTA / aktywny), `✓` Pasuje (koło), `⊘` Bariera (ośmiokąt),
`◆` Sprzeczne (romb), `◌` Brak danych (przerywany), `[P]` tag PRZYKŁAD, `═` uchwyt arkusza.

Priorytety: **P0** = musi działać w demie, **P1** = jeśli zostanie czas, **P2** = tylko w pitchu / slajdzie.

---

### Ekran 1. Start: „Czym się poruszasz?”

```
┌──────────────────────────────────────┐ 390
│                              Pomiń → │  y 56, TextButton
│                                      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  mapa Krakowa w tle, rozmyta 12 px,
│ ░░░░░░ [ilustracja: 2 postacie ░░░░░ │  przyciemniona 60% do #FAF8F5
│ ░░░░░░  na kółkach, fiolet+róż] ░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                      │
│  Czym się                            │  display 32/800
│  poruszasz?                          │
│                                      │
│ ╭────────────────╮╭────────────────╮ │  y ≈ 560 (strefa kciuka)
│ │                ││                │ │  2 kafelki 171×168, radius 20
│ │   (Wheelchair) ││ (BabyCarriage) │ │  ikona 48 px w kole #EDE9FF
│ │                ││                │ │
│ │   Wózek        ││   Wózek        │ │  title 18/600
│ │                ││   dziecięcy    │ │
│ ╰────────────────╯╰────────────────╯ │
│                                      │
│  ⛨ Nie pytamy o zdrowie.            │  caption, text.secondary
└──────────────────────────────────────┘ 844
```

**Microcopy (dokładnie):** „Pomiń” · „Czym się poruszasz?” · „Wózek” · „Wózek dziecięcy” · „Nie pytamy o zdrowie.”

**Interakcje (P0):**
- Tap w kafelek: kafelek wypełnia się `#EDE9FF` z obrysem 2 px fiolet (150 ms), potem przejście do Ekranu 2
  (przenikanie + mapa się wyostrza, 300 ms). Bez przycisku „Dalej”. Profil zapisany w `localStorage`.
- „Pomiń”: Ekran 2 bez profilu. Karty pokazują same fakty bez werdyktu, a w arkuszu stoi chip „Wybierz profil”.
- Lokalizacji nie prosimy. Mapa startuje na Rynku Głównym (zoom 16).

**Stany:** brak (ekran statyczny). Przy powrocie z zapisanym profilem ekran jest pomijany.

**Dostępność:** fokus startuje na nagłówku. Kafelki to `button` z `aria-pressed`. Kolejność Tab: Pomiń → Wózek → Wózek dziecięcy.

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Tło z rozmytą mapą | `Box` + `<img>` | `<div>` + `<img>` (`blur-md opacity-40`) | statyczny PNG, bez żywej mapy na starcie |
| „Pomiń” | `Button variant="text"` | `Button variant="ghost"` | |
| Nagłówek | `Typography variant="display"` | `<h1 class="text-display">` | |
| Kafelki | `Card` + `CardActionArea` w `Stack direction="row"` | `ToggleGroup type="single"` z `ToggleGroupItem` stylowanymi jako karty | `aria-pressed` |
| Ikona w kole | `Avatar` 72 px, `bgcolor: primary.light` | `<span class="size-18 rounded-full bg-primary-container">` | ikona 40 px |
| Nota prywatności | `Typography variant="caption"` + `ShieldCheck` | `<p class="text-caption text-muted-foreground">` | |
| Ilustracja | `<img>` SVG | `<img>` SVG | P1, w P0 sama ikona |

---

### Ekran 2. Mapa + lista (home)

```
┌──────────────────────────────────────┐
│ ╭──────────────────────────────────╮ │ y 56
│ │ ⌕  Dokąd?                        │ │ SearchPill 52 px, cień
│ ╰──────────────────────────────────╯ │
│ (●Wszystko)(Muzea)(Toalety)(Kawiarnie)│ chipy, przewijane poziomo
│▓▓▓▓▓▓  ✓  ▓▓▓▓▓▓▓▓▓  ⊘  ▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓  ◆  ▓▓▓▓▓▓▓▓▓▓▓▓▓  ◌  ▓▓│ piny StatusPin 36 px
│▓▓▓  ◌  ▓▓▓▓▓▓▓▓ Rynek ▓▓▓▓  ✓  ▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓  ✓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓ © OpenStreetMap ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [◎] │ y ≈ 400
├──────────────── ═══ ─────────────────┤ arkusz, stan HALF (top y = 420)
│ ╭─────────────────┬────────────────╮ │
│ │ ● ♿ Wózek       │ 🍼 Dziecięcy   │ │ ProfileSwitch 48 px (kciuk)
│ ╰─────────────────┴────────────────╯ │
│ (✓ 5)  (◆ 2)  (◌ 1)  (⊘ 4)      [P] │ liczniki = filtry
│ ╭──────────────────────────────────╮ │
│ │ ◆ Sprzeczne · toaleta      140 m │ │ PlaceRow 72 px
│ │ Pałac Krzysztofory          [P]  │ │
│ ╰──────────────────────────────────╯ │
│ ╭──────────────────────────────────╮ │
│ │ ✓ Pasuje · 4/4             650 m │ │
│ │ Muzeum Narodowe             [P]  │ │
│ ╰──────────────────────────────────╯ │
│ ╭──────────────────────────────────╮ │
│ │ ⊘ Bariera · 3 stopnie      260 m │ │
│ │ Kamienica Hipolitów         [P]  │ │
│ ╰──────────────────────────────────╯ │
│               [ ≡ Lista ↑ ]          │ przycisk rozwinięcia (zamiast gestu)
└──────────────────────────────────────┘
```

**Microcopy:** „Dokąd?” · „Wszystko” · „Muzea” · „Toalety” · „Kawiarnie” · „Wózek” · „Dziecięcy” ·
liczniki „5 Pasuje”, „2 Sprzeczne”, „1 Brak danych”, „4 Bariera” (słowo w `aria-label`, wizualnie ikona + liczba) ·
„Lista” / „Mapa” · wiersz: `{badge}` + nazwa + odległość (≤ 8 słów).

**Arkusz (2 stany, nie 3):**
- **HALF** (domyślny): top y = 420, widać przełącznik profilu, liczniki i 3 wiersze.
- **FULL**: top y = 112, lista na całą wysokość, mapa zostaje jako pasek pod wyszukiwarką.
- Przełączanie: przycisk „Lista ↑” / „Mapa ↓” (P0). Przeciąganie uchwytu (P1).

**Interakcje (P0):**
1. **Przełącznik profilu (WOW):** tap „Dziecięcy” →
   - piny zmieniają ikonę statusu z animacją scale 0.8→1, stagger 40 ms od środka ekranu;
   - liczniki liczą się animacją count-up (◆ 2 → 1, ◌ 1 → 5, ⊘ 4 → 1; ✓ zostaje 5, ale zmienia skład);
   - lista przesortowuje się (Pasuje → Sprzeczne → Brak danych → Bariera);
   - `aria-live="polite"`: „Profil: wózek dziecięcy. 5 pasuje, 1 sprzeczne, 5 brak danych, 1 bariera.”
2. Tap w licznik: filtruje piny i listę do tego statusu (chip w kolorze statusu, pełny obrys). Ponowny tap: zdejmuje filtr.
3. Tap w pin albo wiersz: Ekran 3. Mapa centruje pin w górnej 1/3.
4. Tap w chip kategorii: filtr kategorii (P0 tylko „Wszystko” i „Muzea”, reszta P1).
5. Tap w `SearchPill`: pełnoekranowa wyszukiwarka z 3 podpowiedziami: „Rynek Główny”, „Dworzec Główny”,
   „Toaleta w pobliżu”. Wybór „Dworzec Główny” → Ekran 6 (P0 jako skrót demo).
6. `◎`: prośba o lokalizację w kontekście (P1).

**Stany:**
- Ładowanie: `Skeleton` wierszy (3 szt.), piny jako szare kropki.
- Pusty filtr: ilustracja + „Nic tu nie pasuje w 100%.” + [Pokaż z 1 stopniem] (P1).
- Brak profilu (po „Pomiń”): zamiast przełącznika chip „Wybierz profil”, wiersze bez badge'a werdyktu, tylko 1 fakt.
- Źródło offline: w nagłówku arkusza mała pigułka `CloudSlash` „1 źródło offline” → otwiera Ekran 4 na banerze (P1).

**Dostępność:** link „Pomiń mapę” jako pierwszy element Tab (skacze do listy). Mapa `aria-hidden`, lista ma tę samą treść
(R6: tekst = mapa). Wiersz czyta: „Sprzeczne dane, toaleta. Pałac Krzysztofory, 140 metrów. Dane przykładowe.”

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Mapa | custom `MapView` (`react-map-gl/maplibre`) | ten sam `MapView` | wspólny, niezależny od biblioteki UI; `Marker` HTML dla ≤ 20 pinów |
| Pin | custom `StatusPin` na `ButtonBase` | custom `StatusPin` na `<button>` | SVG kształtu + ikona Bold; `aria-label` |
| Wyszukiwarka | custom `SearchPill` (`ButtonBase`) → `Dialog fullScreen` + `TextField variant="filled"` + `List` | `Button` pill → `Command` w `Dialog` (pełny ekran na mobile) | podpowiedzi jako `CommandItem` |
| Chipy kategorii | `Chip clickable` w `Stack` `overflowX: auto` | `ToggleGroup type="single"` w `ScrollArea` (poziomo) | aktywny: `primary-container` + ink |
| Arkusz | `SwipeableDrawer anchor="bottom"` *lub* `Paper` fixed + `Collapse` | **Vaul** `Drawer` z `snapPoints={[0.5, 1]}`, `modal={false}` | 2 stany; grabber; przycisk „Lista ↑” jako odpowiednik gestu |
| Przełącznik profilu | `ToggleButtonGroup exclusive fullWidth` | `ToggleGroup type="single"` (segment pill) lub `Tabs` | |
| Liczniki | custom `StatusCounter` (`Chip` + liczba Manrope) | custom `StatusCounter` (`Toggle` + liczba) | count-up: hook `useCountUp` (wspólny) |
| Wiersz miejsca | `Card` + `CardActionArea` (custom `PlaceRow`) | `Card` jako `<button>` (custom `PlaceRow`) | |
| Badge werdyktu | custom `StatusBadge` (na `Chip size="small"`) | custom `StatusBadge` (na `Badge` + warianty `cva`) | dashed border dla `unknown` |
| Tag przykładu | custom `SampleTag` | `Badge variant="outline"` + klasy | |
| „Lista ↑” | `Fab variant="extended"` (ink) | `Button` pill, `bg-ink text-ink-foreground shadow-soft` | |
| Lokalizacja | `IconButton` 48 px na `Paper` | `Button size="icon"` | P1 |
| Ładowanie | `Skeleton variant="rounded"` | `Skeleton` | |
| Ogłoszenie zmiany | `Box aria-live="polite"` + `visuallyHidden` | `<div aria-live="polite" class="sr-only">` | |

---

### Ekran 3. Miejsce: przód karty (werdykt + Twoje potrzeby)

```
┌──────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ●◆  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ mapa 112 px, pin wybrany
├──────────────── ═══ ─────────────[×]─┤ arkusz FULL, radius 24
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ [P] │ hero 160 px: zdjęcie wejścia
│ ░░░ wycinek mapy fiolet + (Bank) ░░░ │ (fallback: wycinek mapy + ikona)
│                                      │
│ Pałac Krzysztofory                   │ h1 28/700
│ Muzeum · Rynek Główny 35 · 140 m     │ body-sm, secondary
│ ╭──────────────────────────────────╮ │
│ │ ◆  Sprzeczne · toaleta           │ │ StatusBadge lg, 56 px
│ │    3 z 4 potrzeb spełnione       │ │ Manrope liczby
│ ╰──────────────────────────────────╯ │
│ Twoje potrzeby                       │ title 18/600
│ ╭──────────────────────────────────╮ │
│ │ ⤒ Próg      0 cm (max 2)     ✓ › │ │ NeedRow 56 px
│ │ ⇿ Drzwi     110 cm (min 80)  ✓ › │ │ granica w nawiasie
│ │ ▤ Winda     jest             ✓ › │ │
│ │ 🚻 Toaleta   ?                ◆ › │ │
│ ╰──────────────────────────────────╯ │
│ ⛁ 3 źródła · najnowsze 06.2025       │ caption
│ ╭────────────────╮╭────────────────╮ │ sticky, y ≈ 772
│ │ ⟲ Skąd wiemy?  ││ ➤ Prowadź    ● │ │ secondary + primary
│ ╰────────────────╯╰────────────────╯ │
└──────────────────────────────────────┘
```

**Microcopy:** „Muzeum · Rynek Główny 35 · 140 m” · „Sprzeczne · toaleta” · „3 z 4 potrzeb spełnione” ·
„Twoje potrzeby” · „Próg” · „0 cm (max 2)” · „Drzwi” · „110 cm (min 80)” · „Winda” · „jest” · „Toaleta” · „?” ·
„3 źródła · najnowsze 06.2025” · „Skąd wiemy?” · „Prowadź”.

**Kolejność wierszy:** najpierw potrzeby z problemem (◆, ⊘, ◌), potem spełnione. Zawsze 4 potrzeby profilu.
Pozostałe fakty (parking OzN, przewijak) w zwijanym „Więcej (2)” (P1).

**Potrzeby profili (presety, edycja progów = P2):**
- **Wózek:** Próg ≤ 2 cm (0 stopni) · Drzwi ≥ 80 cm · Winda (jeśli piętro) · Toaleta dostosowana.
- **Wózek dziecięcy:** Stopnie ≤ 1 lub rampa dla wózka · Drzwi ≥ 70 cm · Winda (jeśli piętro) · Przewijak.

**Warianty werdyktu:** `✓ Pasuje · 4/4` / `⊘ Bariera · 3 stopnie` (+ wiersz bariery na górze) /
`◌ Brak danych · 2 z 4` (+ przycisk „Byłeś tu? Uzupełnij” zamiast „Prowadź” jako CTA główne).

**Interakcje (P0):**
- „Skąd wiemy?” → Ekran 4 (flip karty w miejscu).
- Tap w `NeedRow` → Ekran 4 z przewinięciem do tego faktu i jego podświetleniem.
- „Prowadź” → Ekran 6 (cel = to miejsce, start = Dworzec Główny w demie).
- `×` → Ekran 2.

**Stany:** ładowanie (szkielet badge'a i 4 wierszy), brak zdjęcia (wycinek mapy, podpis „Brak zdjęcia”), miejsce PRZYKŁAD
(tag na hero i przy nazwie).

**Dostępność:** nagłówek czytany jako: „Sprzeczne dane. 3 z 4 potrzeb spełnione, toaleta niepewna. Pałac Krzysztofory.”
(werdykt przed nazwą). Każdy `NeedRow` to `button`: „Próg 0 centymetrów, Twój limit 2, pasuje. Pokaż źródło.”

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Arkusz pełny | `Drawer anchor="bottom"` (wysokość `calc(100% - 112px)`) | Vaul `Drawer` (snap 1) / `DrawerContent` | grabber + przycisk `×` |
| Hero | `CardMedia` lub `Box` z obrazem | `AspectRatio` + `<img>` | atrybucja zdjęcia jako caption |
| Werdykt duży | custom `StatusBadge size="lg"` | custom `StatusBadge size="lg"` | tło w kolorze `status.bg` |
| Lista potrzeb | `List` + `ListItemButton` (custom `NeedRow`) w `Card` | `Card` + `<button>` wiersze (custom `NeedRow`) + `Separator` | wartość Manrope, `CaretRight` |
| Linia źródeł | `Typography variant="caption"` | `<p class="text-caption">` | |
| Akcje sticky | `Stack` w `Paper` sticky: `Button outlined` + `Button contained` | `DrawerFooter`: `Button variant="outline"` + `Button` | 56 px |
| Więcej faktów | `Accordion` | `Collapsible` / `Accordion` | P1 |
| Ładowanie | `Skeleton` | `Skeleton` | |

---

### Ekran 4. Druga strona: „Skąd wiemy?” (źródło, konflikt, stare dane, źródło offline)

```
┌──────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ●◆  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
├──────────────── ═══ ─────────────[×]─┤ ta sama karta, obrócona
│ Skąd wiemy?                          │ h1
│ Pałac Krzysztofory                   │ body-sm
│ ╭──────────────────────────────────╮ │ Alert (conflict tone)
│ │ ☁̸ Źródło miasta offline.          │ │
│ │   Kopia z 1.10.2026              │ │
│ ╰──────────────────────────────────╯ │
│ ⤒ Próg 0 cm                       ✓  │ ProvenanceRow
│   ⛨ Potwierdzone · Deklaracja · 03.2026│
│ ⇿ Drzwi 110 cm                    ✓  │
│   ⛨ Potwierdzone · Deklaracja · 03.2026│
│ ▤ Winda jest                      ✓  │
│   👥 Społeczność · OSM · 06.2025      │
│ 🚻 Toaleta              ◆ Sprzeczne   │
│ ╭───────────────╮╭───────────────╮   │ 2 EvidenceCard obok siebie
│ │ Jest, platforma││ Brak          │   │
│ │ ⛨ Miasto (ZIW) ││ 👥 OSM         │   │
│ │ 🕓 11.2023      ││ 06.2025       │   │
│ │   3 lata       ││               │   │
│ ╰───────────────╯╰───────────────╯   │
│ Byłeś tu?   ( Jest )   ( Nie ma )    │ chipy 48 px
│ Edytuj w OSM ↗                       │ link
│ ╭────────────────╮╭────────────────╮ │ sticky
│ │ ⟲ Przód        ││  Popraw      ● │ │
│ ╰────────────────╯╰────────────────╯ │
└──────────────────────────────────────┘
```

**Microcopy:** „Skąd wiemy?” · „Źródło miasta offline. Kopia z 1.10.2026” · „Potwierdzone” · „Społeczność” ·
„Deklaracja” · „OSM” · „Miasto (ZIW)” · „Jest, platforma” · „Brak” · „3 lata” · „Sprzeczne” · „Byłeś tu?” · „Jest” · „Nie ma” ·
„Edytuj w OSM” · „Przód” · „Popraw”.

**Zasady:**
- Każdy fakt: wartość + status, pod spodem 1 linia `{poziom} · {źródło} · {data}` (caption, ikona poziomu).
- **Konflikt:** oba źródła obok siebie, ten sam ciężar wizualny, brak „zwycięzcy”. Starsze ma `ClockCounterClockwise` + wiek.
- **Stare dane:** próg wieku: budynki 3 lata, windy i awarie 7 dni. Fakt stary dostaje zegar i wiek, status bez zmian koloru.
- **Źródło offline:** baner u góry, dane nie znikają, data kopii zawsze widoczna. W demie: realny 404 na `msip3.um.krakow.pl`
  (toalety ZIW) → dane z ostatniej kopii.
- Tap w nazwę źródła otwiera mini-arkusz źródła: nazwa zbioru, URL, licencja, częstotliwość, ostatnie pobranie, stan
  (P1; w P0 link `ArrowSquareOut` do URL źródła).

**Interakcje (P0):**
- Wejście: flip `rotateY(180deg)` 300 ms całej zawartości arkusza (reduced-motion: przenikanie).
- „Nie ma” / „Jest” w konflikcie → Ekran 5 z preselekcją wartości (zostaje 1 tap „Wyślij”).
- „Popraw” → Ekran 5 bez preselekcji.
- „Przód” → Ekran 3 (flip wstecz).
- „Edytuj w OSM ↗” → `openstreetmap.org/edit?node=…` w nowej karcie (dla faktów z OSM, R2).

**Stany:** fakt bez danych: wiersz „◌ Przewijak · Brak danych”, pod spodem „Nikt jeszcze nie sprawdził.” + [Uzupełnij] ·
fakt ze zgłoszenia: `ChatCircleDots` „Zgłoszenie · dziś · niezweryfikowane” · fakt PRZYKŁAD: tag zamiast poziomu pewności.

**Dostępność:** nagłówek „Skąd wiemy?” dostaje fokus po flipie. Konflikt czytany jako grupa:
„Toaleta, sprzeczne dane. Miasto, ZIW: jest, platforma, listopad 2023, dane sprzed 3 lat. OpenStreetMap: brak, czerwiec 2025.”

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Kontener flip | custom `FlipCard` (CSS `preserve-3d`) | ten sam `FlipCard` (klasy Tailwind `transform-3d`, `rotate-y-180`, `backface-hidden`) | ~40 linii |
| Baner offline | `Alert severity="warning"` + ikona `CloudSlash` | `Alert` + wariant `conflict` (`cva`) | kolory z tokenów `status.conflict` |
| Wiersze faktów | `List` + custom `ProvenanceRow` (`ListItem` + `ListItemText secondary`) | custom `ProvenanceRow` (`<li>` + `Separator`) | |
| Dowody konfliktu | custom `EvidenceCard` ×2 (`Card variant="outlined"`) w `Stack row` | custom `EvidenceCard` ×2 (`Card`) w `grid grid-cols-2` | równe szerokości |
| Wiek danych | `Chip size="small" variant="outlined"` | `Badge variant="outline"` | ikona `ClockCounterClockwise` |
| „Byłeś tu?” | `Chip clickable` ×2 (48 px) | `Button variant="outline"` ×2, pill | |
| Mini-arkusz źródła | custom `ProvenanceSheet` = `Drawer anchor="bottom"` | custom `ProvenanceSheet` = Vaul `Drawer` (zagnieżdżony, `NestedRoot`) | P1 |
| Link OSM | `Link` + `ArrowSquareOut` | `<a>` + `buttonVariants({variant:"link"})` | `target="_blank" rel="noopener"` |
| Akcje | jak Ekran 3 | jak Ekran 3 | |

---

### Ekran 5. Popraw dane (≤ 3 tapy, bez konta)

```
5a · wybór wartości                     5b · po wysłaniu (powrót do Ekranu 4)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓ (Ekran 4, przyciemniony) ▓▓│ │ ...                                  │
├──────────────── ═══ ─────────────────┤ │ 🚻 Toaleta              ◆ Sprzeczne   │
│ Toaleta · Pałac Krzysztofory         │ │ ╭───────╮╭───────╮╭───────╮          │
│ Jak jest teraz?                      │ │ │Jest   ││Brak   ││Brak   │          │
│                                      │ │ │⛨ ZIW  ││👥 OSM  ││💬 Ty   │          │
│ ╭──────────────────────────────────╮ │ │ │11.2023││06.2025││teraz  │          │
│ │ ✓ Jest, z platformą              │ │ │ ╰───────╯╰───────╯╰───────╯          │
│ ╰──────────────────────────────────╯ │ │                                      │
│ ╭──────────────────────────────────╮ │ │ ╭──────────────────────────────────╮ │
│ │ ◐ Jest, bez platformy            │ │ │ │ ♥ Dzięki! Czeka na weryfikację.  │ │ Snackbar róż
│ ╰──────────────────────────────────╯ │ │ │                          Cofnij  │ │
│ ╭──────────────────────────────────╮ │ │ ╰──────────────────────────────────╯ │
│ │ ● ⊘ Nie ma toalety               │ │ └──────────────────────────────────────┘
│ ╰──────────────────────────────────╯ │
│ 📷 Dodaj zdjęcie (opcjonalnie)       │
│ ╭──────────────────────────────────╮ │
│ │            Wyślij              ● │ │ 56 px
│ ╰──────────────────────────────────╯ │
│  Bez konta. Bez e-maila.             │ caption
└──────────────────────────────────────┘
```

**Microcopy:** „Toaleta · Pałac Krzysztofory” · „Jak jest teraz?” · „Jest, z platformą” · „Jest, bez platformy” ·
„Nie ma toalety” · „Dodaj zdjęcie (opcjonalnie)” · „Wyślij” · „Bez konta. Bez e-maila.” · toast:
„Dzięki! Czeka na weryfikację.” · „Cofnij”.

**Licznik tapów:** „Popraw” (1) → wartość (2) → „Wyślij” (3). Z konfliktu („Nie ma”) wartość jest preselekcjonowana: 2 tapy.
Opcje są **kontekstowe dla faktu** i zawsze to chipy z wartościami: drzwi `(70)(80)(90)(100+) cm`, próg `(0)(1–2)(3–5)(>5) cm`,
winda `(Działa)(Nie działa)(Nie ma)`. Pole tekstowe nigdy na start.

**Zasada zaufania:** zgłoszenie **nie zmienia werdyktu na lepszy** i nie nadpisuje źródła Potwierdzone. Dochodzi jako trzeci dowód
z poziomem „Zgłoszenie · niezweryfikowane”. Może najwyżej utrzymać lub wywołać „Sprzeczne”.

**Interakcje (P0):** wybór opcji (radio), „Wyślij” → zapis do `localStorage` / endpointu `POST /reports` (P1), powrót do Ekranu 4
z trzecią `EvidenceCard` + `Snackbar`. „Cofnij” usuwa zgłoszenie. Zdjęcie: P2 (przycisk widoczny, otwiera wybór pliku, EXIF usuwany).

**Dostępność:** opcje to `radiogroup` z etykietą „Jak jest teraz?”. Po wysłaniu fokus wraca na wiersz toalety, toast ogłoszony `role="status"`.

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Arkusz | `Drawer anchor="bottom"` (auto height) | Vaul `Drawer` (bez snapPoints) | radius 24 + grabber |
| Opcje | `RadioGroup` + custom `OptionCard` (`CardActionArea`, `role="radio"`) | `RadioGroup` (Radix) z `RadioGroupItem` stylowanym jako karta (custom `OptionCard`) | wybrana: obrys 2 px fiolet + `primary-container` |
| Zdjęcie | `Button variant="text" startIcon` + ukryty `input type=file` | `Button variant="ghost"` + ukryty `input type=file` | P2 |
| Wyślij | `Button variant="contained" fullWidth size="large"` | `Button size="lg" class="w-full"` | disabled bez wyboru |
| Toast | `Snackbar` + `Alert` (tło `secondary.light`) z akcją „Cofnij” | **Sonner** `toast("Dzięki! Czeka na weryfikację.", { action: { label: "Cofnij" } })` | 5 s, `role="status"` |

---

### Ekran 6. Trasa Dworzec Główny → Rynek Główny (odcinki jako tekst)

```
┌──────────────────────────────────────┐
│ ‹  ╭──────────────────────────────╮  │ y 56
│    │ (Train) Dworzec Główny       │  │ RouteHeader
│    │ (●)    Rynek Główny       ⇅  │  │
│    ╰──────────────────────────────╯  │
│ (●Bez schodów) (Najkrótsza)          │ presety
│▓▓▓▓●━━━━━━┓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓┃▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ linia 6 px fiolet,
│▓▓▓▓▓▓▓▓▓▓▓┇ ◌ 90 m ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ odcinek bez danych: szary przerywany
│▓▓▓▓▓▓▓▓▓▓▓┗━━━━━━━━━━━━━━━━●▓▓▓▓▓▓▓▓│
│▓ © OpenStreetMap ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ y ≈ 380
├──────────────── ═══ ─────────────────┤
│ 16 min · 1,2 km                 [P]  │ Manrope 28/800
│ ◌ Brak danych · 90 m                 │ StatusBadge trasy
│ 0 schodów · 1 krawężnik 2 cm         │ body-sm
│ ████████████▒▒▒████████████████      │ SegmentBar 12 px, proporcjonalny
│ ╭──────────────────────────────────╮ │
│ │ ⊘ Najkrótsza · 12 min · 24 schody│ │ AltRouteRow (tap = zmiana)
│ ╰──────────────────────────────────╯ │
│ Po drodze                            │
│ 1 ✓ Hala dworca → wyjście · winda    │ SegmentRow (pionowa lista)
│ 2 ✓ Przejście Basztowa · krawężnik 2 cm│
│ 3 ◌ Planty · 90 m · nawierzchnia ?   │
│ 4 ✓ ul. Floriańska · płyty · 2%      │
│ 5 ✓ Rynek Główny · płyty             │
│ ╭──────────────────────────────────╮ │ sticky
│ │            Ruszamy             ● │ │
│ ╰──────────────────────────────────╯ │
└──────────────────────────────────────┘
```

**Microcopy:** „Dworzec Główny” · „Rynek Główny” · „Bez schodów” · „Najkrótsza” · „16 min · 1,2 km” · „Brak danych · 90 m” ·
„0 schodów · 1 krawężnik 2 cm” · „Najkrótsza · 12 min · 24 schody” · „Po drodze” · wiersze jak w makiecie · „Ruszamy”.

**Zasady:**
- Werdykt trasy liczony jak werdykt miejsca: 1 odcinek nieznany = „Brak danych · 90 m”, a nie „Pasuje”.
- `SegmentBar`: pełny w kolorze statusu = znane; szary w paski 45° = brak danych; ośmiokąt nad paskiem = bariera.
  Nigdy fioletowy ciągły dla odcinka bez danych.
- Pionowa lista odcinków **jest** tekstową alternatywą mapy (R6). Mapa nie pokazuje niczego, czego nie ma w liście.

**Interakcje (P0):**
- Tap w odcinek paska lub wiersz: podświetla odcinek na mapie (`fitBounds`), wiersz rozwija się o 1 linię źródła:
  „👥 Społeczność · OSM · 06.2025” albo „◌ Nikt jeszcze nie sprawdził · [Uzupełnij]”.
- Tap w `AltRouteRow` / chip „Najkrótsza”: zamiana trasy na mapie i w liście (2 przygotowane trasy).
- **Przełącznik profilu na trasie (P1, mocny beat dla rodzica):** chip profilu w nagłówku arkusza. Dla „Wózek dziecięcy” trasa
  „Najkrótsza” zmienia się z `⊘ 24 schody` na `✓ Pasuje · 24 schody z rampą` (realna podstawa: `ramp:stroller` w OSM).
- „Ruszamy”: P2 (snackbar „Nawigacja krok po kroku w kolejnej wersji”). W demie nie klikamy.

**Stany:** brak trasy bez barier: `⊘ Każda trasa ma barierę` + [Pokaż z 1 krawężnikiem do 3 cm] · routing niedostępny:
„Nie wyznaczymy teraz trasy.” + [Spróbuj ponownie] (dane trasy w prototypie są statycznym GeoJSON PRZYKŁAD).

**Dostępność:** lista odcinków to `ol`. Wiersz czyta: „Odcinek 3 z 5. Planty, 90 metrów. Brak danych o nawierzchni.”
Mapa `aria-hidden`.

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Nagłówek trasy | `Paper` + 2× `ListItem` + `IconButton` | `Card` + 2 wiersze + `Button size="icon"` | pola nieedytowalne w P0 |
| Presety | `ToggleButtonGroup exclusive` (pill) | `ToggleGroup type="single"` | |
| Mapa + linia | `MapView` + `Source`/`Layer` (`line-dasharray` dla unknown) | ten sam | GeoJSON statyczny |
| Arkusz | `Paper` fixed (2 stany jak Ekran 2) | Vaul `Drawer` `snapPoints={[0.55, 1]}`, `modal={false}` | |
| Podsumowanie | `Typography variant="h1"` + `StatusBadge` | `<p class="text-h1 font-num">` + `StatusBadge` | |
| Pasek odcinków | custom `SegmentBar` (flex `Box`, szerokość ∝ długość) | custom `SegmentBar` (`flex`, `style={{flexGrow: m}}`) | ~60 linii, `button` na odcinek |
| Alternatywa | `Card` + `CardActionArea` (custom `AltRouteRow`) | `Card` jako `<button>` | |
| Lista odcinków | `Timeline` z `@mui/lab` (`TimelineDot` = ikona statusu, `TimelineConnector` dashed dla unknown) + `Collapse` | custom `RouteSegmentRow` w `<ol>` (kreska `border-l-2`, `border-dashed` dla unknown) + `Collapsible` | shadcn nie ma Timeline |
| CTA | `Button variant="contained" fullWidth size="large"` | `Button size="lg" class="w-full"` | |

---

### Ekran 7. Widget „Karta dostępności” u hotelu (model biznesowy)

```
┌──────────────────────────────────────┐
│ 🔒 hotel-przyklad.pl         [P]     │ pasek „przeglądarki” (mock)
│ ░░░░░░░░ zdjęcie hotelu (ilustr.) ░░ │ strona hotelu, wyszarzona 30%
│ Hotel Przykład ★★★                   │
│ Pokój dwuosobowy · 420 zł            │
│ ╭──────────────────────────────────╮ │ NASZ WIDGET (ten sam komponent)
│ │ Dostępność           [P]         │ │
│ │ ( ● Wózek )( Dziecięcy )         │ │ ToggleButtonGroup
│ │ ✓ Pasuje · 4/4                   │ │ StatusBadge
│ │ (Próg 0 cm)(Drzwi 90 cm)         │ │ FactChip ×3
│ │ (Prysznic bez brodzika)          │ │
│ │ ⛨ Dane obiektu · zweryf. 09.2026 │ │ ProvenanceLine
│ │ Z Dworca: 12 min · 0 schodów  ›  │ │ deep link → Ekran 6
│ │                Kraków bez barier │ │ podpis marki (fiolet)
│ ╰──────────────────────────────────╯ │
│ ╭──────────────────────────────────╮ │
│ │          Zarezerwuj              │ │ CTA hotelu (ink, nie fiolet)
│ ╰──────────────────────────────────╯ │
│ ──────────────────────────────────── │
│ Dla obiektów: Karta 49 zł/mies.      │ pasek „Dla firm”
│ Weryfikacja na miejscu od 590 zł     │
└──────────────────────────────────────┘
```

**Microcopy:** „hotel-przyklad.pl” · „Hotel Przykład” · „Pokój dwuosobowy · 420 zł” · „Dostępność” · „Wózek” · „Dziecięcy” ·
„Pasuje · 4/4” · „Próg 0 cm” · „Drzwi 90 cm” · „Prysznic bez brodzika” · „Dane obiektu · zweryf. 09.2026” ·
„Z Dworca: 12 min · 0 schodów” · „Kraków bez barier” · „Zarezerwuj” · „Dla obiektów: Karta 49 zł/mies.” ·
„Weryfikacja na miejscu od 590 zł”.

**Zasady:** hotel jest fikcyjny (żadnej realnej marki ani domeny), cały ekran ma tag PRZYKŁAD. **Ranking w aplikacji nigdy nie jest
płatny**; płatne są widget, weryfikacja i API. Ten sam silnik werdyktu, ten sam `StatusBadge` i ta sama druga strona
(tap w linię źródła odwraca widget).

**Interakcje (P0):** przełącznik profilu w widgecie przelicza werdykt (Dziecięcy: `◌ Brak danych · przewijak`, co pokazuje,
że widget też nie kłamie). „Z Dworca…” → Ekran 6. Wejście do ekranu: URL `/widget/demo` (osobna trasa Next.js, dzięki czemu
widget jest naprawdę osadzalny jako `iframe`).

**Komponenty (A: MUI | B: shadcn/ui):**

| Element | A: MUI v9 | B: shadcn/ui + Tailwind v4 | Uwagi |
|---|---|---|---|
| Mock strony hotelu | `Box` + `Typography` + ilustracja | `<div>` + ilustracja | bez zdjęcia realnego hotelu |
| Widget | custom `AccessCardWidget` = `Card variant="outlined"` + `ToggleButtonGroup` + `StatusBadge` + `FactChip` ×3 + `ProvenanceLine` | custom `AccessCardWidget` = `Card` + `ToggleGroup` + `StatusBadge` + `FactChip` ×3 + `ProvenanceLine` | reużywa komponentów z Ekranów 2–4 |
| Fakty | custom `FactChip` (`Chip`) | custom `FactChip` (`Badge variant="secondary"`, pill, h-9) | ≤ 2 słowa + liczba |
| Deep link | `Link` + `CaretRight` | `<a>` + `CaretRight` | |
| CTA hotelu | `Button variant="contained" color="inherit"` (ink) | `Button` z klasą `bg-ink text-ink-foreground` | nie nasz fiolet |
| Pasek cennika | `Typography variant="body2"` + `Divider` | `<p class="text-body-sm">` + `Separator` | |

---

## 5. Ścieżka kliknięć demo (3:00, grupa „na kółkach”)

| Czas | Ekran | Klik | Co mówimy | Wymóg |
|---|---|---|---|---|
| 0:00–0:10 | 1 | Tap „Wózek” | „Jedno pytanie. Nie pytamy o zdrowie, tylko o progi i drzwi.” | R4 |
| 0:10–0:40 | 2 | Tap „Dziecięcy”, potem z powrotem „Wózek” | **WOW 1:** „Ten sam Kraków, inna osoba.” Piny i liczniki się przeliczają. „Każde miejsce: werdykt z liczbą. Szare to brak danych, nigdy zielone.” | R4, R1, porażka |
| 0:40–1:00 | 3 | Tap wiersz „Pałac Krzysztofory” | „Nie piszemy »dostępne«. Próg 0 cm przy Twoim limicie 2. Drzwi 110 przy minimum 80. Toaleta: sprzeczne.” | R1, R4 |
| 1:00–1:40 | 4 | Tap „Skąd wiemy?” | **WOW 2:** karta się odwraca. „Każdy fakt: źródło, data, pewność. Miasto mówi »jest«, ale ma 3 lata. OSM mówi »brak«. Pokazujemy oba. A serwer miasta jest teraz offline, prawdziwy 404, więc pokazujemy kopię z datą.” | R2, R3, porażka ×3 |
| 1:40–1:55 | 5 | Tap „Nie ma” → „Wyślij” | „2 tapy, bez konta. Zgłoszenie nie nadpisuje źródła, jest oznaczone jako niezweryfikowane.” | R2, R7 |
| 1:55–2:25 | 6 | `×` → wyszukiwarka → „Dworzec Główny” (albo „Prowadź” z Ekranu 3) | „Dworzec → Rynek: 16 min, 0 schodów. 90 m Plant bez danych: szare, nie fioletowe. Lista odcinków to tekst mapy.” 3 s VoiceOver na wierszu 3. | R1, R6, porażka |
| 2:25–2:50 | 7 | Przełączenie na `/widget/demo`, tap „Dziecięcy” | „Kto płaci? Hotel osadza tę samą kartę. 49 zł miesięcznie, weryfikacja od 590 zł. Ranking nigdy nie jest płatny.” | biznes, R8 |
| 2:50–3:00 | — | — | „Każde miejsce ma drugą stronę. Z przodu: czy to dla Ciebie. Z tyłu: skąd to wiemy.” | puenta |

**Klikalne w prototypie (minimum P0):** kafelek „Wózek” · przełącznik profilu (Ekran 2) · wiersz Pałacu · „Skąd wiemy?” /
„Przód” · „Nie ma” + „Wyślij” + „Cofnij” · `×` · wyszukiwarka → „Dworzec Główny” · „Prowadź” · tap odcinka 3 ·
„Najkrótsza” · przełącznik w widgecie · „Z Dworca…”. Wszystko inne może być nieaktywne (`aria-disabled` + tooltip
„W kolejnej wersji”).

**Klawiatura (do nagrania 10 s w filmie):** Tab: Pomiń mapę → lista → Enter na Pałacu → Tab do „Skąd wiemy?” → Enter. Esc zamyka arkusz.

---

## 6. Tokeny (niezależne od biblioteki) i ich mapowanie

Źródłem prawdy są tokeny z sekcji 3. Trzymamy je raz, w `packages/ui/src/tokens.ts` (obiekt TS), i generujemy z nich
oba motywy. Dzięki temu wersje A (MUI) i B (shadcn/ui) wyglądają tak samo, a porównujemy tylko bibliotekę.

### 6.1 Zestawienie tokenów

| Grupa | Token | Light | Dark |
|---|---|---|---|
| Kolor | `primary` / `primary-hover` / `primary-container` / `on-primary` | `#5B3DF5` / `#4A2FE0` / `#EDE9FF` / `#FFFFFF` | `#A99BFF` / `#7C68FF` / `#2A2440` / `#0F0D16` |
| Kolor | `blush` / `blush-container` | `#FFB8D9` / `#FFD6E8` | `#FF9CCB` / `#3A2433` |
| Kolor | `background` / `surface` / `surface-raised` | `#FAF8F5` / `#FFFFFF` / `#FFFFFF` | `#0F0D16` / `#1A1724` / `#2A2440` |
| Kolor | `ink` / `ink-muted` | `#16141F` / `#625E70` | `#F3F1F8` / `#ABA6BA` |
| Kolor | `border-strong` / `divider` | `#8E8A9A` / `#ECE8E3` | `#6E6982` / `#2A2440` |
| Status | `met` / `met-bg` | `#1E7B4F` / `#E6F4EC` | `#5FD39A` / `#12261C` |
| Status | `barrier` / `barrier-bg` | `#C42B1C` / `#FCE9E7` | `#FF8A7A` / `#2E1512` |
| Status | `conflict` / `conflict-bg` | `#9A5A00` / `#FFF3DC` | `#FFC15C` / `#2B2010` |
| Status | `unknown` / `unknown-bg` | `#5B6270` / `#EEF0F3` | `#AEB4C0` / `#22252C` |
| Typografia | `font-display` / `font-body` | Manrope / Inter | — |
| Typografia | skala | display 32/38·800 · h1 28/34·700 · h2 22/28·700 · title 18/24·600 · body 17/24 · body-sm 15/22 · label 15/20·600 · button 16·600 · caption 13/18·500 · num = Manrope 800 tabular | — |
| Radius | `radius-sm` / `radius-card` / `radius-sheet` / `radius-pill` / `radius-tag` | 12 / 20 / 24 / 999 / 6 | — |
| Cień | `shadow-soft` | `0 1px 2px rgba(22,20,31,.06), 0 6px 20px rgba(91,61,245,.10)` | `none` + obrys 1 px `#2A2440` |
| Cień | `shadow-sheet` | `0 -2px 8px rgba(22,20,31,.06), 0 -12px 32px rgba(91,61,245,.10)` | `none` |
| Spacing | baza 4 | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56; margines ekranu 16 | — |
| Rozmiary | `touch-min` / `cta-h` / `chip-h` / `pin` / `pin-selected` | 48 / 56 / 36 / 36 / 48 | — |
| Ruch | `ease-out` / `dur-fast` / `dur` / `dur-flip` | `cubic-bezier(.2,.8,.2,1)` / 150 / 250 / 300 ms | — |
| Fokus | `focus-ring` | 3 px `primary`, offset 2 px | jw. |

**Wspólne zasady wyglądu „nie-Material” (A i B):**
- bez elevation, tylko `shadow-soft`;
- bez rippla, zamiast niego `active: scale(.97)`;
- bez wersalików w przyciskach;
- przyciski i chipy pill, przyciski min. 48 px (CTA 56);
- arkusz z radius 24 i uchwytem 36×4 w kolorze `border-strong`;
- tło ciepłe `background`, nigdy czysta szarość.

### 6.2 Wersja A: MUI v9 (`createTheme`)

- **Paleta:** `cssVariables: { colorSchemeSelector: 'data' }` + `colorSchemes.light/dark.palette` z tokenów.
  - `primary {main, dark=hover, light=container, contrastText=on-primary}`;
  - `secondary` = blush;
  - `background {default, paper=surface}`;
  - `text {primary=ink, secondary=ink-muted}`, `divider`;
  - własne klucze przez module augmentation: `palette.status[met|barrier|conflict|unknown] = {main, bg}`,
    `palette.borderStrong`, `palette.ink`;
  - `success/error/warning` wskazują na kolory statusów (spójność `Alert`).
- **Kształt i typografia:** `shape.borderRadius: 12`, `spacing: 4`. `typography.fontFamily` = Inter,
  `h1/h2` w Manrope, nowe warianty `display` i `num` przez augmentację `TypographyVariants`, `button.textTransform: 'none'`.
- **`components.styleOverrides`:**
  - `MuiButtonBase.defaultProps.disableRipple`;
  - `MuiButton`: radius 999, `minHeight` 48, `sizeLarge` 56, `disableElevation`;
  - `MuiPaper` / `MuiCard`: `elevation: 0`, `boxShadow: shadow-soft`, radius 20; dark przez `theme.applyStyles('dark', …)`: bez cienia, obrys;
  - `MuiChip`: pill 36 px;
  - `MuiToggleButtonGroup` / `MuiToggleButton`: segment pill, wybrany = `primary`;
  - `MuiDrawer.paperAnchorBottom`: radius 24, `shadow-sheet`, uchwyt przez `&::before`;
  - `MuiFilledInput`: pill bez podkreślenia;
  - `MuiCssBaseline`: `:focus-visible` i `prefers-reduced-motion`.
- Wartości w `styleOverrides` czytamy z `theme.vars.palette.*`, nie z hexów.

### 6.3 Wersja B: shadcn/ui + Tailwind v4 (+ Vaul, Sonner)

- **Zmienne shadcn** w `globals.css` (`:root` i `.dark`), wartości z tokenów (hex albo przeliczone do OKLCH):

  | Zmienna shadcn | Token |
  |---|---|
  | `--background` / `--foreground` | background / ink |
  | `--card`, `--popover` / `--card-foreground`, `--popover-foreground` | surface / ink |
  | `--primary` / `--primary-foreground` | primary / on-primary |
  | `--secondary`, `--accent` / `--secondary-foreground`, `--accent-foreground` | primary-container / ink |
  | `--muted` / `--muted-foreground` | background / ink-muted |
  | `--destructive` | barrier |
  | `--border` / `--input` / `--ring` | divider / border-strong / primary |
  | `--radius` | `0.75rem` (12 px) |

- **Dodatkowe zmienne** w `@theme inline` (Tailwind v4), żeby powstały klasy:
  `--color-status-met`, `--color-status-met-bg` (i tak dla 4 statusów), `--color-primary-container`, `--color-blush`,
  `--color-blush-container`, `--color-ink`, `--color-ink-foreground`, `--color-border-strong`, `--radius-card: 20px`,
  `--radius-sheet: 24px`, `--shadow-soft`, `--shadow-sheet`, `--font-display` (Manrope), `--font-sans` (Inter),
  `--text-display` … `--text-caption` (z `--line-height`).
- **Komponenty shadcn** to nasz kod, więc zmieniamy je w plikach:
  - `Button`: `rounded-full h-12`, `size="lg"` → `h-14`, `active:scale-[.97]`;
  - `Card`: `rounded-[var(--radius-card)] shadow-soft border-0`, dark: `border`;
  - `Badge`: warianty statusów przez `cva` (`met | barrier | conflict | unknown`, `unknown` z `border-dashed`);
  - Vaul `DrawerContent`: `rounded-t-[var(--radius-sheet)] shadow-sheet`, uchwyt 36×4 `bg-border-strong`.
- **Sonner:** `<Toaster position="bottom-center" />`, `toastOptions.classNames` w kolorach `blush-container` + ink.
- **Ikony:** Phosphor (`@phosphor-icons/react`) w obu wersjach, żeby porównanie nie mieszało zestawów.
  Ikony lucide wygenerowane przez CLI shadcn (np. `ChevronDown`, `X`) podmieniamy na Phosphor.

### 6.4 Komponenty custom do napisania (`packages/ui`, oba warianty)

| Komponent | A: bazuje na (MUI) | B: bazuje na (shadcn/ui) | Szacunek |
|---|---|---|---|
| `StatusBadge` (`status`, `reason`, `size: sm \| lg`) | `Chip` / `Paper` | `Badge` + `cva` | 1 h |
| `StatusPin` (SVG: koło / ośmiokąt / romb / koło przerywane + ikona) | `ButtonBase` | `<button>` | 1,5 h (wspólny SVG) |
| `StatusCounter` + `useCountUp` | `Chip` | `Toggle` | 1 h |
| `SampleTag` | `Box` | `Badge variant="outline"` | 0,25 h |
| `FactChip` | `Chip` | `Badge variant="secondary"` | 0,5 h |
| `PlaceRow` | `Card` + `CardActionArea` | `Card` jako `<button>` | 0,5 h |
| `NeedRow` | `ListItemButton` | `<button>` + `Separator` | 0,5 h |
| `FlipCard` | CSS 3D (wspólny) | CSS 3D (wspólny) | 1 h |
| `ProvenanceRow` + `EvidenceCard` | `ListItem`, `Card` | `<li>`, `Card` | 1,5 h |
| `ProvenanceSheet` (P1) | `Drawer` | Vaul `Drawer` (nested) | 1 h |
| `OptionCard` (radio) | `RadioGroup` + `CardActionArea` | Radix `RadioGroup` | 0,5 h |
| `SegmentBar` + `RouteSegmentRow` | `Box`, `@mui/lab` `Timeline` | `flex` + `<ol>` z `border-l` | 2 h |
| `MapView` (MapLibre, markery, linia trasy) | `react-map-gl/maplibre` (wspólny) | jw. | 3 h |
| `BottomPanel` (2 stany, przycisk, drag P1) | `Paper` + `Collapse` / `SwipeableDrawer` | Vaul `snapPoints` | 1,5 h (B: drag w cenie) |
| `AccessCardWidget` | składanka powyższych | składanka powyższych | 1 h |
| **Razem UI na wariant** | | | **≈ 17 h** |

Logika wspólna dla obu wariantów (poza bibliotekami UI, w `packages/`): zbiór danych PRZYKŁAD, `matchVerdict`
(pure function + testy GIVEN/WHEN/THEN), `useCountUp`, `MapView`, `StatusPin`, `FlipCard`, teksty `pl.ts`.
Przy 2 wariantach budżet 20 h nie wystarczy na oba w pełni: rekomendacja to wariant A i B tylko dla Ekranów 2–4
(najwięcej arkuszy, kart i toastów, czyli tam, gdzie różnice bibliotek są widoczne), potem decyzja.

---

## 7. Zbiór danych przykładowych (wszystko **PRZYKŁAD**)

Nazwy to realne, publiczne miejsca Krakowa użyte jako tło. **Wszystkie wartości, daty i źródła przypisane niżej są
ilustracyjne** i w UI noszą tag `PRZYKŁAD`, dopóki nie zastąpi ich ingest (OSM, MSIP/ZIW, deklaracje dostępności).
Wyjątek: stan „źródło offline” dla hosta `msip3.um.krakow.pl` jest prawdziwy.

### 7.1 Miejsca (Ekran 2–4, 7)

Werdykty: W = Wózek, D = Wózek dziecięcy.

| # | Miejsce (kategoria, adres) | Odl. od Rynku | Fakty (wartość · źródło · data · pewność) | W | D |
|---|---|---|---|---|---|
| 1 | **Pałac Krzysztofory** (muzeum, Rynek Główny 35) | 140 m | Próg 0 cm · Deklaracja · 03.2026 · Potwierdzone; Drzwi 110 cm · Deklaracja · 03.2026 · Potwierdzone; Winda jest · OSM · 06.2025 · Społeczność; Toaleta: **ZIW „jest, platforma” 11.2023 (stare, kopia offline) vs OSM „brak” 06.2025**; Przewijak: brak danych | ◆ Sprzeczne · toaleta | ◌ Brak danych · przewijak |
| 2 | **Muzeum Narodowe, Gmach Główny** (muzeum, al. 3 Maja 1) | 650 m | Próg 0 cm (wejście od ul. Piłsudskiego); Drzwi 120 cm; Winda jest; Toaleta dostosowana; Przewijak jest · wszystko Deklaracja · 03.2026 | ✓ Pasuje · 4/4 | ✓ Pasuje · 4/4 |
| 3 | **Sukiennice, Galeria Sztuki Polskiej XIX w.** (muzeum, Rynek Główny 3) | 50 m | Próg 0 cm; Drzwi 90 cm; Winda jest · Deklaracja · 02.2026; Toaleta dostosowana · OSM · 05.2025; Przewijak jest | ✓ Pasuje · 4/4 | ✓ Pasuje · 4/4 |
| 4 | **Kamienica Hipolitów** (muzeum, pl. Mariacki 3) | 260 m | 3 stopnie · 17 cm każdy · OSM · 06.2025; Drzwi 85 cm; Winda brak; Toaleta brak danych | ⊘ Bariera · 3 stopnie | ⊘ Bariera · 3 stopnie |
| 5 | **Podziemia Rynku** (muzeum, Rynek Główny 1) | 80 m | Winda: OSM „jest” 06.2025 vs **Zgłoszenie „nie działa” 2 dni temu**; Próg 0 cm; Drzwi 100 cm; Toaleta dostosowana | ◆ Sprzeczne · winda | ◆ Sprzeczne · winda |
| 6 | **Kościół Mariacki** (zabytek, pl. Mariacki 5) | 120 m | 1 stopień 12 cm · OSM · 04.2025; rampa dla wózka dziecięcego jest; Drzwi 140 cm | ⊘ Bariera · 1 stopień 12 cm | ✓ Pasuje · 3/3 (rampa) |
| 7 | **Teatr im. J. Słowackiego** (teatr, pl. Św. Ducha 1) | 550 m | 2 stopnie · 15 cm · OSM · 2022 (stare); Platforma: brak danych | ⊘ Bariera · 2 stopnie | ◌ Brak danych · 2 z 4 |
| 8 | **Kawiarnia przy Rynku** (kawiarnia, „Kawiarnia Przykład”, nazwa fikcyjna) | 300 m | brak danych dla wszystkich potrzeb | ◌ Brak danych · 0 z 4 | ◌ Brak danych · 0 z 4 |
| 9 | **Toaleta miejska, Planty** (toaleta ZIW, okolice Barbakanu) | 450 m | Toaleta dostosowana: platforma · ZIW · 11.2023 (stare, kopia offline); Przewijak jest · ZIW · 11.2023; Godziny 8–20 | ✓ Pasuje · 2/2* | ✓ Pasuje · 2/2* |
| 10 | **Galeria Krakowska, wejście od Dworca** (handel, ul. Pawia 5) | 1,1 km | Próg 0 cm; Drzwi automatyczne 180 cm; Winda jest; Toaleta dostosowana; Przewijak jest · OSM · 07.2025 | ✓ Pasuje · 4/4 | ✓ Pasuje · 4/4 |
| 11 | **Muzeum Książąt Czartoryskich** (muzeum, ul. Pijarska 15) | 500 m | Próg 0 cm; Drzwi 100 cm; Winda jest; Toaleta dostosowana · Deklaracja · 01.2026 | ✓ Pasuje · 4/4 | ◌ Brak danych · przewijak |
| 12 | **Collegium Maius** (muzeum, ul. Jagiellońska 15) | 400 m | 2 stopnie · OSM · 03.2025; Drzwi 80 cm; Winda brak danych | ⊘ Bariera · 2 stopnie | ◌ Brak danych · winda |

\* Toaleta publiczna ma tylko potrzeby dotyczące toalety (2), więc licznik to 2/2. Stare dane są widoczne na drugiej stronie.

**Liczniki na Ekranie 2 (12 miejsc, wynikają z tabeli):**
- Wózek: ✓ 5 (#2, 3, 9, 10, 11) · ◆ 2 (#1, 5) · ◌ 1 (#8) · ⊘ 4 (#4, 6, 7, 12). Do makiety: ✓ 5 · ◆ 2 · ◌ 1 · ⊘ 4.
- Dziecięcy: ✓ 5 (#2, 3, 6, 9, 10) · ◆ 1 (#5) · ◌ 5 (#1, 7, 8, 11, 12) · ⊘ 1 (#4).

Builder: liczniki w makiecie na Ekranie 2 mają pochodzić z funkcji `matchVerdict` na tym zbiorze, nie z ręcznie
wpisanych liczb. Zwróć uwagę, że przejście W → D **nie** jest „wszystko lepiej”:
Pasuje zostaje 5, ale skład się zmienia (Mariacki zyskuje rampę, Czartoryskich traci przez nieznany przewijak).
To lepiej pokazuje R4 niż proste 12 → 15.

### 7.2 Źródła (druga strona, baner offline, `ProvenanceSheet`)

| Źródło | Rodzaj / pewność | Stan w demie | Ostatnie pobranie |
|---|---|---|---|
| OpenStreetMap (ekstrakt Geofabrik) | Społeczność | Działa | dziś 06:00 (PRZYKŁAD) |
| Toalety publiczne ZIW (MSIP, `msip3.um.krakow.pl`) | Potwierdzone (miasto) | **Offline (404, realne)** → kopia | Kopia z 1.10.2026 (PRZYKŁAD daty) |
| Deklaracje dostępności podmiotów publicznych | Potwierdzone (zarządca, wyciąg) | Działa | 2.10.2026 (PRZYKŁAD) |
| Miejsca postojowe OzN (ZDMK, AGOL) | Potwierdzone (miasto) | Działa | 17.09.2026 (PRZYKŁAD) |
| Zgłoszenia użytkowników | Zgłoszenie (niezweryfikowane) | 12 oczekujących (PRZYKŁAD) | — |

### 7.3 Trasa Dworzec Główny → Rynek Główny (Ekran 6, statyczny GeoJSON, PRZYKŁAD)

**„Bez schodów”: 16 min · 1,2 km · ◌ Brak danych · 90 m**

| # | Odcinek | Długość | Fakty | Status | Źródło |
|---|---|---|---|---|---|
| 1 | Hala dworca → wyjście na pl. Jana Nowaka-Jeziorańskiego | 180 m | Winda jest · 0 stopni | ✓ | OSM · 06.2025 |
| 2 | Przejście przez ul. Basztową | 60 m | Krawężnik 2 cm · sygnalizacja | ✓ | OSM · 06.2025 |
| 3 | Planty (alejka) | 90 m | Nawierzchnia: brak danych | ◌ | — |
| 4 | ul. Floriańska | 330 m | Płyty · nachylenie 2% | ✓ | OSM · 04.2025 |
| 5 | Rynek Główny (do Sukiennic) | 540 m | Płyty · 0 stopni | ✓ | OSM · 05.2025 |

**„Najkrótsza”: 12 min · 0,9 km · ⊘ Bariera · 24 schody** (przejście podziemne). Dla profilu „Wózek dziecięcy”:
`✓ Pasuje · 24 schody z rampą` (rampa dla wózka, `ramp:stroller=yes`, OSM · 08.2025).

### 7.4 Hotel (Ekran 7)

**Hotel Przykład** (fikcyjny, `hotel-przyklad.pl`): Próg 0 cm · Drzwi pokoju 90 cm · Prysznic bez brodzika ·
Winda jest · Przewijak: brak danych · źródło „Dane obiektu · zweryfikowane na miejscu 09.2026”.
Werdykt: Wózek `✓ Pasuje · 4/4`, Dziecięcy `◌ Brak danych · przewijak`. Trasa z Dworca: 12 min · 0 schodów.
Cennik (research-business.md): Karta 49 zł/mies. (490 zł/rok), Pro 149 zł/mies., weryfikacja na miejscu 590–990 zł.

---

## 8. Ryzyka i plan B (dla zespołu)

1. **MapLibre nie zdąży:** Ekran 2 działa jako sama lista (stan FULL na stałe) z przyciskiem „Mapa” nieaktywnym.
   Demo nic nie traci, bo lista jest pełnowartościowym tekstem mapy (R6).
2. **Routing:** w prototypie trasa jest statyczna (GeoJSON PRZYKŁAD). Tak mówimy jury. Nie udajemy routingu.
3. **Flip karty:** jeśli 3D zawodzi na Safari, przenikanie 200 ms + zmiana nagłówka. Metafora zostaje w copy.
4. **Zdjęcia:** brak zdjęć = wycinek mapy + ikona kategorii. Nie wstawiamy zdjęć bez licencji.
5. **Słowo „Pasuje”:** zawsze z licznikiem (4/4) i jedną linią źródła pod spodem. Nigdy „Dostępne”, nigdy „Gwarantujemy”.
