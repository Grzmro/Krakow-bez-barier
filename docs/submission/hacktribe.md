# Kraków bez barier — teksty zgłoszenia (HackTribe)

> Teksty do wklejenia w formularz HackTribe, zgodne ze stanem `main` na 3.10.2026 (wykaz funkcji:
> [features.md](features.md)). Liczby oznaczone „szacunek” to nasze wyliczenia; resztę podajemy ze źródłem.
>
> **Przed wysłaniem uzupełnić (PLACEHOLDER):** `[ID zespołu]`, `[link do demo]`, `[link do filmu MP4]`,
> `[link do repozytorium]` (sprawdzić, czy repozytorium jest publiczne), `[link do PDF]`.

## ID zespołu

**[ID zespołu — PLACEHOLDER]**

## Tytuł projektu

Kraków bez barier — każde miejsce ma drugą stronę

## Opis rozwiązania

Kraków bez barier to aplikacja webowa — także instalowalna PWA z trybem offline i aplikacja iOS/Android z tego samego kodu — w której mieszkańcy i turyści sprawdzają, czy miejsce pasuje do ich potrzeb. Zamiast etykiety „dostępne / niedostępne” pokazujemy konkretne fakty: stopnie, próg, szerokość drzwi, windę, nawierzchnię, toaletę dostosowaną, przewijak, miejsca odpoczynku i parking. Każdy fakt ma „drugą stronę” (przycisk „Skąd wiemy?”): źródło, datę pozyskania lub potwierdzenia i poziom wiarygodności.

Bez konta i bez pytań o zdrowie: użytkownik może jednym kliknięciem włączyć profil potrzeb („Wózek” albo „Wózek dziecięcy”). Profil porównuje fakty z progami użytkownika i pokazuje werdykt: „Spełnia”, „Nie spełnia”, „Sprzeczne” albo „Brak danych”. Brak informacji nigdy nie jest pokazywany jako dostępność. Brakujące lub błędne dane można uzupełnić albo potwierdzić bez konta; zgłoszenie trafia do panelu moderatora (kolejka, decyzja, historia „kto, co, kiedy”) i nigdy nie nadpisuje danych innego źródła — po zatwierdzeniu różnica z aktualnym faktem innego źródła jest pokazywana jako „Sprzeczne” (fakt starszy niż 12 miesięcy ustępuje świeżemu).

Te same dane trafiają do partnerów: hotel lub organizator osadza kartę dostępności na swojej stronie jako widget (`<iframe>`, bez konta), a aplikacje turystyczne i systemy rezerwacji pobierają je przez publiczne API tylko do odczytu (OpenAPI 3.1, dokumentacja pod `/api/docs`) — każda cecha ze źródłem, datą, statusem i licencją.

## Problem

- Etykieta „dostępne” nie pozwala ocenić, czy konkretna osoba wjedzie, wejdzie i skorzysta z toalety.
- Danych szczegółowych prawie nie ma: w centrum (Stare Miasto + Kazimierz + Stradom) tylko 99 z 649 miejsc w OpenStreetMap (15%) ma jakąkolwiek informację o dostępności dla wózków, a żadne nie ma liczby stopni ani szerokości drzwi (odczyt Overpass z 3.10.2026, opis w `docs/demo-data.md`). Dla całego Krakowa nasza analiza wstępna daje 8,7% (2 674 z 30 573 POI, ekstrakt Geofabrik z 3.10.2026) — analiza własna, skrypt i metoda nie są jeszcze w repozytorium.
- 42% osób z potrzebami dostępności rezygnuje z miejsca, jeśli nie znajdzie informacji, a tylko 13% czuje się pewnie, idąc w nowe miejsce (Euan’s Guide Access Survey 2025, UK).
- Dane, które istnieją, są rozproszone (OSM, MSIP, ZTP), mają różną świeżość i często sobie przeczą. Miasto nie chce utrzymywać własnej bazy ręcznie.

## Grupa docelowa i sposób użycia

Prototyp skupia się na dwóch grupach: **osobach poruszających się na wózku** i **rodzicach z wózkami dziecięcymi**. Z tej samej karty korzystają też seniorzy (co piąty krakowianin ma 60+, Radio Kraków), osoby po urazie i turyści z walizką. Kraków odwiedziło w 2025 r. 16,25 mln osób (MOT/UMK, Badanie ruchu turystycznego 2025).

Scenariusz: użytkownik wyszukuje miejsce (mapa + równoważna lista tekstowa), włącza profil „Wózek”, widzi werdykt z konkretem (np. „Nie spełnia” z grupą „Blokuje”: „Wejście: 3 stopnie”), otwiera „Skąd wiemy?”, żeby sprawdzić źródło i datę, a gdy czegoś brakuje — uzupełnia informację w kilku krokach, bez konta. Kartę miejsca można udostępnić linkiem. Hotel lub organizator osadza tę samą kartę na swojej stronie jako widget (strona „Dla firm” daje gotowy kod), a moderator zatwierdza zgłoszenia w panelu `/moderator`. Na telefonie aplikację można zainstalować jako PWA albo aplikację iOS/Android; „W mojej okolicy” ustala pozycję na urządzeniu i nie wysyła jej na serwer.

Dostępność cyfrowa (cel WCAG 2.2 AA): automatyczny audyt axe i snapshoty ARIA w każdym teście e2e, pełna obsługa klawiaturą, lista równoważna mapie, statusy rozróżnialne bez koloru (ikona + kształt + słowo), deklaracja dostępności z listą ograniczeń. Do zrobienia: testy z użytkownikami czytników ekranu, zewnętrzny audyt WCAG i wersja angielska (zaplanowana).

## Źródła danych oraz ocena świeżości i wiarygodności

Używamy wyłącznie otwartych danych, bez dostępu do systemów UMK/MJO i bez bazy utrzymywanej przez miasto.

| Źródło | Co daje | Licencja / warunki | Odświeżanie | Gdy niedostępne |
|---|---|---|---|---|
| OpenStreetMap (Overpass API) | Miejsca, `wheelchair`, `toilets:wheelchair`, opis dostępności, przewijak, `check_date` | ODbL 1.0, atrybucja „© OpenStreetMap contributors” | codziennie (cron ingest) | ostatnia dobra kopia z datą, status „awaria” |
| MSIP Kraków: toalety publiczne (warstwa WT_WC_2023, dane ISDP) | 50 toalet: dostępność, rodzaj dostosowania (poziom 0 / platforma / winda / pochylnia), przewijak, godziny | regulamin MSIP — **licencja do potwierdzenia z miastem**; adapter gotowy, regularnie nie ładujemy do potwierdzenia; w danych demo jednorazowy odczyt 9 toalet z 3.10.2026 (przypadek „sprzeczne”) | zbiór z 2023 r. | ostatnia kopia z datą i oznaczeniem „może być nieaktualne” |
| ZDMK: miejsca postojowe dla osób z niepełnosprawnościami (ArcGIS Online) | 2 037 miejsc parkingowych (odczyt warstwy 3.10.2026, `docs/data-sources.md`; że zbiór prowadzi ZDMK — do potwierdzenia) | **licencja do potwierdzenia**; adapter gotowy, nie ładujemy do potwierdzenia | brak harmonogramu | ostatnia kopia z datą |
| ZTP Kraków: inwentaryzacja przystanków (ArcGIS Online) | przystanki: ławki, nawierzchnia peronu | **licencja do potwierdzenia**; adapter gotowy, nie ładujemy do potwierdzenia | data edycji rekordu | ostatnia kopia z datą |
| Zgłoszenia użytkowników (moderowane) | uzupełnienia, korekty, potwierdzenia | regulamin usługi | na bieżąco | — |

**Model wiarygodności.** Każdy fakt ma źródło, datę pozyskania / potwierdzenia, licencję i poziom zaufania: *Potwierdzone* (zarządca, miasto, audyt) → *Społeczność* (OSM z datą edycji) → *Zgłoszenie* (niezweryfikowane). Modyfikatory: *Może być nieaktualne* (fakt starszy niż próg), *Sprzeczne* (źródła się nie zgadzają — pokazujemy obie wartości, nie uśredniamy), *Brak danych* (nigdy „dostępne”). Zgłoszenie nigdy nie nadpisuje danych zarządcy.

**Pobieranie.** Osobny proces ingest (codzienny cron) pobiera źródła przez adaptery, zapisuje fakty z pochodzeniem i dziennikiem uruchomień. Aplikacja nie odpytuje źródeł w czasie żądania; awaria źródła = ostatnia dobra kopia z datą i komunikat na stronie „O danych”. Źródło bez potwierdzonej licencji nie jest ładowane — reguła wymuszona w kodzie. Kolejne źródło to nowy adapter, kolejne miasto to plik konfiguracyjny (przykład: Wrocław na samym OSM).

**Trzy prawdziwe przypadki błędów pokazywane w demo:**
1. Dane sprzeczne — toaleta przy ul. Konopnickiej: MSIP „brak przewijaka”, OSM `changing_table=yes`.
2. Dane niepełne — Hotel Miodowa: w OSM tylko `wheelchair=yes`, brak stopni, drzwi, windy.
3. Źródło niedostępne — adresy `msip3.um.krakow.pl` wskazywane w katalogu MSIP zwracają HTTP 404 (3.10.2026). W demo wywołujemy awarię przełącznikiem serwera i pokazujemy, co widzi użytkownik: ostatnią kopię z datą i status „awaria” źródła.

Dane przykładowe w prototypie są oznaczone tagiem i stałym banerem „PRZYKŁAD”.

## Model biznesowy

**Darmowe dla ludzi, płatne dla tych, którzy zarabiają na dostępności.** Mieszkańcy i turyści nigdy nie płacą i nie potrzebują konta. Dane pozostają otwarte (ODbL), a kod jest open source — płaci się za weryfikację, aktualność (SLA), integrację i wygodę. Ranking w aplikacji nigdy nie jest płatny.

| Produkt | Klient | Cena (propozycja) |
|---|---|---|
| Karta dostępności (widget na stronę i do systemu rezerwacji, QR, statystyki) | hotele, lokale, muzea | od 49 zł/mies.; sieć 149 zł/mies. |
| Weryfikacja obiektu (status „Zweryfikowane — data”) | obiekty, gminy | zdalna 290 zł, na miejscu 590–990 zł |
| Karta wydarzenia | organizatorzy | 290–990 zł / wydarzenie |
| API danych o dostępności | aplikacje turystyczne, mapowe, rezerwacyjne | od 490 zł/mies.; 1 990 zł/mies. z SLA |
| White-label dla miast i gmin | samorządy, DMO (PFRON, EFS+) | wdrożenie 25–60 tys. zł + 2–6 tys. zł/mies. |

Motywacja klientów: 42% klientów z potrzebami dostępności rezygnuje bez informacji, 70% wraca tam, gdzie jest dostępnie (Euan’s Guide 2025); od 28.06.2025 Polski Akt o Dostępności (EAA) obejmuje rezerwacje online noclegów i wydarzeń. Benchmarki: AccessAble (UK) ok. 150 £ za przewodnik obiektu; Wrocław sfinansował z PFRON 650 audytów obiektów (2017).

Szacunek: ok. 450 tys. zł przychodu w 2. roku (Kraków + 2 miasta white-label), próg rentowności ok. 24. miesiąca, marża brutto na kliencie „Karta” ok. 80%.

Kierunki rozwoju: kolejne profile (senior, osoba z bagażem, osoby niewidome), dostępne trasy piesze, panel właściciela obiektu, integracje z systemami rezerwacji, kolejne miasta w Polsce i regionie V4.

## Plan utrzymania poza infrastrukturą miasta

- **Właściciel i operator:** spółka z o.o. non-profit / przedsiębiorstwo społeczne prowadzone przez zespół, z radą programową z udziałem organizacji osób z niepełnosprawnościami.
- **Hosting:** chmura komercyjna w UE po stronie operatora; szacunkowo 800–2 000 zł/mies. w 1. roku. Miasto nic nie hostuje.
- **Aktualizacje danych:** automatyczny ingest (cron) z monitoringiem dostępności źródeł; poprawki faktów obiektywnych wracają do OpenStreetMap.
- **Bezpieczeństwo:** operator — HTTPS wszędzie, aktualizacje zależności, pentest raz w roku. Już w prototypie: limity zgłoszeń na klienta, walidacja zakresów, pułapka na boty, usuwanie e-maili i telefonów z komentarzy, logowanie moderatora z blokadą po 5 nieudanych próbach. Nie zbieramy informacji o niepełnosprawności; profil zostaje w przeglądarce, lokalizacja na urządzeniu.
- **Obsługa zgłoszeń:** moderator operatora (0,25–0,5 etatu w 1. roku, szacunek) w panelu `/moderator` (kolejka, decyzje, historia); docelowo także właściciele obiektów.
- **Koszty:** pokrywane z abonamentów B2B (karta, API), umów B2G (white-label) i grantów (PFRON, UE) na pierwsze 12 miesięcy.
- **Rola miasta:** publikuje otwarte dane i promuje usługę; 0 zł za utrzymanie bazy.
- **Prawa autorskie:** planujemy kod open source (licencja do ustalenia przez zespół), dane OSM na ODbL — tak, by po przeniesieniu praw majątkowych na Miasto operator mógł nadal legalnie hostować i rozwijać usługę (do potwierdzenia z Miastem).
- **Roadmapa:** 0 mies. prototyp → 3 mies. MVP, widget v1, audyt WCAG, pilot z 30 obiektami na Starym Mieście → 12 mies. API v1, 300+ zweryfikowanych obiektów, pierwsze miasto white-label → 24 mies. 3–5 miast, integracje z systemami rezerwacji.
- **Kolejne miasto:** plik konfiguracyjny (obszar OSM, lokalne zbiory danych z potwierdzoną licencją, kategorie) — działa już w kodzie, przykład Wrocław; partner lokalny (NGO lub uczelnia), finansowanie audytów pierwszych ~100 obiektów; cel 2–4 tygodnie wdrożenia (szacunek).

Pełne materiały w repozytorium: `docs/submission/features.md` (wykaz funkcji), `docs/submission/privacy-security.md` (ochrona danych), `docs/submission/operations.md` (utrzymanie poza UMK), `docs/data-sources.md` (rejestr źródeł), `docs/deployment.md` (zależności, licencje, kolejne miasto).

## Linki

- Demo: **[link do demo — PLACEHOLDER]** (wdrożenie w toku, KBB-21)
- Publiczne API i dokumentacja: **[link do demo]/api/docs — PLACEHOLDER**
- Repozytorium: **[link do repozytorium — PLACEHOLDER]** (kandydat: https://github.com/Grzmro/Krakow-bez-barier, sprawdzić dostęp publiczny)
- Film (MP4, do 3 min): **[link do filmu — PLACEHOLDER]**
- Prezentacja (PDF, 10 slajdów): **[link do PDF — PLACEHOLDER]** (eksport z https://claude.ai/artifact/CUZoLZxBkFv77dpRreWyDU)
