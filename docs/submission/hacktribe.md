# Kraków bez barier — teksty zgłoszenia (HackTribe)

> Teksty do wklejenia w formularz HackTribe, zgodne ze stanem `main` na 3.10.2026 (wykaz funkcji:
> [features.md](features.md)). Liczby oznaczone „szacunek” to nasze wyliczenia; resztę podajemy ze źródłem.
>
> **Przed wysłaniem uzupełnić (PLACEHOLDER):** `[ID zespołu]`, `[link do demo]`, `[link do filmu MP4]`,
> `[link do repozytorium]` (sprawdzić, czy repozytorium jest publiczne), `[link do PDF]`; na Vercelu ustawić
> `MODERATOR_DEMO_TOKEN`, bez którego przycisk konta demo się nie pokaże (sekcja „Instructions on how to open project”).

## ID zespołu

**[ID zespołu — PLACEHOLDER]**

## Tytuł projektu

Kraków bez barier — każde miejsce ma drugą stronę

## Opis rozwiązania

Kraków bez barier to aplikacja webowa — także instalowalna PWA z trybem offline i aplikacja iOS/Android z tego samego kodu — w której mieszkańcy i turyści sprawdzają, czy miejsce pasuje do ich potrzeb. Zamiast etykiety „dostępne / niedostępne” pokazujemy konkretne fakty: stopnie, próg, szerokość drzwi, windę, nawierzchnię, toaletę dostosowaną, przewijak, miejsca odpoczynku i parking. Każdy fakt ma „drugą stronę” (przycisk „Skąd wiemy?”): źródło, datę pozyskania lub potwierdzenia i poziom wiarygodności.

Bez konta i bez pytań o zdrowie: użytkownik może jednym kliknięciem włączyć profil potrzeb („Wózek”, „Wózek dziecięcy” albo „Senior”). Profil porównuje fakty z progami użytkownika i pokazuje werdykt: „Spełnia”, „Nie spełnia”, „Sprzeczne” albo „Brak danych”. Brak informacji nigdy nie jest pokazywany jako dostępność. Brakujące lub błędne dane można uzupełnić albo potwierdzić bez konta; zgłoszenie trafia do panelu moderatora (kolejka, decyzja, historia „kto, co, kiedy”) i nigdy nie nadpisuje danych innego źródła — po zatwierdzeniu różnica z aktualnym faktem innego źródła jest pokazywana jako „Sprzeczne” (fakt starszy niż 12 miesięcy ustępuje świeżemu).

Z karty miejsca można też wyznaczyć trasę do niego („Prowadź”; start: Dworzec Główny, stały w prototypie — start z własnej pozycji lub dowolnego adresu to kolejny krok): openrouteservice z profilem wózka i opcją „Unikaj schodów”, a na każdym odcinku nawierzchnia, schody i nachylenie ze źródłem i datą („Krok po kroku”) — odcinek bez danych jest pokazany jako „brak danych”, nigdy jako spełniający potrzeby.

Te same dane trafiają do partnerów: hotel osadza kartę dostępności na swojej stronie jako widget (`<iframe>`, bez konta), organizator wydarzenia generuje stronę „Dojazd i wejście bez barier” dla swojego obiektu, a aplikacje turystyczne i systemy rezerwacji pobierają dane przez publiczne API tylko do odczytu (OpenAPI 3.1, dokumentacja pod `/api/docs`) — każda cecha ze źródłem, datą, statusem i licencją.

**Co nas wyróżnia** (wszystko poniżej jest w kodzie, wykaz z numerami PR: `docs/submission/features.md`):
- **Prawdziwe dane miejskie, nie tylko OSM.** Adaptery do trzech warstw miasta — toalety MSIP, miejsca postojowe OZN, przystanki ZTP — przetestowane na zapisanych odczytach z 3.10.2026. Kod ładuje je dopiero po potwierdzeniu licencji z miastem. Warstwa toalet MSIP okazała się nie być danymi otwartymi, więc jej dane wyłączyliśmy (aplikacja ich nie pokazuje, karta źródła mówi dlaczego); toalety bierzemy z listy miasta na krakow.pl („Kraków bez barier”, 65 toalet, stan na 15.09.2025), z jawnym oznaczeniem „licencja niekomercyjna, do potwierdzenia”.
- **Konflikty i awarie źródeł obsłużone, nie ukryte.** Sprzeczne źródła pokazujemy obok siebie; gdy źródło nie odpowiada, zostaje ostatnia dobra kopia z datą, a OSM ma zapasowy kanał (ekstrakt Geofabrik, gdy Overpass zawodzi).
- **Trzy kanały B2B już działają:** widget dla hotelu, strona wydarzenia dla organizatora, publiczne API z dokumentacją.
- **Jeden kod → web, PWA z trybem offline i aplikacja iOS/Android**, po polsku i angielsku.
- **WCAG 2.2 sprawdzany automatycznie:** audyt axe i snapshot ARIA w teście e2e każdego ekranu.
- **Dostępne trasy** z barierami i lukami w danych na każdym odcinku.

## Problem

- Etykieta „dostępne” nie pozwala ocenić, czy konkretna osoba wjedzie, wejdzie i skorzysta z toalety.
- Danych szczegółowych prawie nie ma. Po naszym imporcie OpenStreetMap dla centrum (Stare Miasto + Kazimierz + Stradom, ekstrakt Geofabrik z 2.10.2026) tylko 130 z 960 miejsc (13,5%) ma jakąkolwiek informację o dostępności dla wózków, 42 z nich mają datę sprawdzenia, a **żadne** nie ma liczby stopni, szerokości drzwi, podjazdu ani windy (zapytanie i tabela w `docs/demo-data.md`). Dla całego Krakowa nasza analiza wstępna daje 8,7% (2 674 z 30 573 POI, ekstrakt Geofabrik z 3.10.2026) — analiza własna, skrypt nie jest jeszcze w repozytorium. Dlatego nie polegamy na jednym źródle: łączymy OSM z danymi miasta i moderowanymi zgłoszeniami, a brak danych mówimy wprost.
- 42% osób z potrzebami dostępności rezygnuje z miejsca, jeśli nie znajdzie informacji, a tylko 13% czuje się pewnie, idąc w nowe miejsce (Euan’s Guide Access Survey 2025, UK).
- Dane, które istnieją, są rozproszone (OSM, MSIP, ZTP), mają różną świeżość i często sobie przeczą. Miasto nie chce utrzymywać własnej bazy ręcznie.

## Grupa docelowa i sposób użycia

Prototyp skupia się na dwóch grupach: **osobach poruszających się na wózku** i **rodzicach z wózkami dziecięcymi**. Z tej samej karty korzystają też seniorzy (co piąty krakowianin ma 60+, Radio Kraków), osoby po urazie i turyści z walizką. Kraków odwiedziło w 2025 r. 16,25 mln osób (MOT/UMK, Badanie ruchu turystycznego 2025).

Scenariusz: użytkownik wyszukuje miejsce (mapa + równoważna lista tekstowa), włącza profil „Wózek”, widzi werdykt z konkretem (np. „Nie spełnia” z grupą „Blokuje”: „Wejście: 3 stopnie”), otwiera „Skąd wiemy?”, żeby sprawdzić źródło i datę, a gdy czegoś brakuje — uzupełnia informację w kilku krokach, bez konta; zgłoszenie od razu widać na karcie jako „Niezweryfikowane”. Z karty wyznacza trasę („Prowadź”; start: Dworzec Główny, stały w prototypie) z barierami na odcinkach. Kartę miejsca można udostępnić linkiem. Hotel osadza tę samą kartę na swojej stronie jako widget, a organizator generuje stronę wydarzenia (strona „Dla firm” daje gotowy kod i link). Moderator zatwierdza zgłoszenia w panelu `/moderator`. Na telefonie aplikację można zainstalować jako PWA albo aplikację iOS/Android; „W mojej okolicy” ustala pozycję na urządzeniu i nie wysyła jej na serwer.

Dostępność cyfrowa (cel WCAG 2.2 AA): automatyczny audyt axe i snapshoty ARIA w teście e2e każdego ekranu (uruchamiane lokalnie; e2e nie jest jeszcze w CI), pełna obsługa klawiaturą, lista równoważna mapie, statusy rozróżnialne bez koloru (ikona + kształt + słowo), deklaracja dostępności z listą ograniczeń. Interfejs jest po polsku i angielsku (przełącznik w menu). Do zrobienia: testy z użytkownikami czytników ekranu i zewnętrzny audyt WCAG.

## Źródła danych oraz ocena świeżości i wiarygodności

Używamy wyłącznie otwartych danych, bez dostępu do systemów UMK/MJO i bez bazy utrzymywanej przez miasto.

| Źródło | Co daje | Licencja / warunki | Odświeżanie | Gdy niedostępne |
|---|---|---|---|---|
| OpenStreetMap (Overpass API; zapasowo ekstrakt Geofabrik) | Miejsca, `wheelchair`, `toilets:wheelchair`, opis dostępności, przewijak, `check_date` | ODbL 1.0, atrybucja „© OpenStreetMap contributors” | codziennie (cron ingest) | ekstrakt Geofabrik z datą ekstraktu; gdy i on zawiedzie — ostatnia dobra kopia z datą, status „awaria” |
| krakow.pl „Kraków bez barier”: Toalety ogólnodostępne | 65 toalet dostosowanych z rodzajem udogodnienia (platforma / winda / pochylnia / poziom 0); 24 dopasowane do toalet z OSM | regulamin krakow.pl: użycie niekomercyjne dozwolone — **licencja niekomercyjna, do potwierdzenia** dla użycia komercyjnego; oznaczone na karcie źródła, wyłączalne flagą | co tydzień (data aktualizacji strony przy każdym fakcie) | ostatnia kopia z datą i oznaczeniem „może być nieaktualne” |
| MSIP Kraków: toalety publiczne (warstwa WT_WC_2023, dane ISDP) | 50 toalet | warstwa **nie jest w katalogu OPEN DATA MSIP** — dane wyłączone, nie pokazujemy ich do czasu potwierdzenia warunków przez miasto | zbiór z 2023 r. | — |
| ZDMK: miejsca postojowe dla osób z niepełnosprawnościami (ArcGIS Online) | 2 037 miejsc parkingowych (odczyt warstwy 3.10.2026, `docs/data-sources.md`; że zbiór prowadzi ZDMK — do potwierdzenia) | **licencja do potwierdzenia**; adapter gotowy, nie ładujemy do potwierdzenia | brak harmonogramu | ostatnia kopia z datą |
| ZTP Kraków: inwentaryzacja przystanków (ArcGIS Online) | przystanki: ławki, nawierzchnia peronu | **licencja do potwierdzenia**; adapter gotowy, nie ładujemy do potwierdzenia | data edycji rekordu | ostatnia kopia z datą |
| openrouteservice (HeiGIT, dane OSM) — tylko trasy, nie zapisujemy | geometria trasy, nawierzchnia, schody, nachylenie na odcinkach | warunki usługi HeiGIT, atrybucja przy trasie; użycie komercyjne **do potwierdzenia** | na żądanie, po stronie serwera | komunikat „wyznaczanie trasy niedostępne”, dane miejsc działają dalej |
| Zgłoszenia użytkowników (moderowane) | uzupełnienia, korekty, potwierdzenia | regulamin usługi | na bieżąco | — |

**Model wiarygodności.** Każdy fakt ma źródło, datę pozyskania / potwierdzenia, licencję i poziom zaufania: *Potwierdzone* (zarządca, miasto, audyt) → *Społeczność* (OSM z datą edycji) → *Zgłoszenie* (niezweryfikowane). Modyfikatory: *Może być nieaktualne* (fakt starszy niż próg), *Sprzeczne* (źródła się nie zgadzają — pokazujemy obie wartości, nie uśredniamy), *Brak danych* (nigdy „dostępne”). Zgłoszenie nigdy nie nadpisuje danych zarządcy.

**Pobieranie.** Osobny proces ingest (codzienny cron) pobiera źródła przez adaptery, zapisuje fakty z pochodzeniem i dziennikiem uruchomień. Aplikacja nie odpytuje źródeł w czasie żądania; awaria źródła = ostatnia dobra kopia z datą i komunikat na stronie „O danych”. Źródło bez potwierdzonej licencji nie jest ładowane — reguła wymuszona w kodzie. Kolejne źródło to nowy adapter, kolejne miasto to plik konfiguracyjny (przykład: Wrocław na samym OSM).

**Trzy prawdziwe przypadki błędów pokazywane w demo:**
1. Dane rozbieżne — toaleta w Sukiennicach: lista miasta (krakow.pl, 15.09.2025) „dostosowana, platforma”, OSM `wheelchair=limited`. Pokazujemy oba źródła z datami; dane miasta są starsze niż rok, więc oznaczamy je „może być nieaktualne”.
2. Dane niepełne — Hotel Miodowa: w OSM tylko `wheelchair=yes`, brak stopni, drzwi, windy.
3. Źródło niedostępne — adresy `msip3.um.krakow.pl` wskazywane w katalogu MSIP zwracają HTTP 404 (3.10.2026), więc awarie miejskich serwisów się zdarzają. W demo wywołujemy awarię źródła krakow.pl przełącznikiem serwera i pokazujemy, co widzi użytkownik: ostatnią kopię z datą i status „awaria” źródła.

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

Kierunki rozwoju: kolejne profile (osoba z bagażem, osoby niewidome), dostępne trasy piesze, panel właściciela obiektu, integracje z systemami rezerwacji, kolejne miasta w Polsce i regionie V4.

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

## Instructions on how to open project

Tekst do pola „Instructions on how to open project”. Przycisk konta demo pokazuje się tylko, gdy na Vercelu jest
ustawione `MODERATOR_DEMO_TOKEN` (16+ znaków, np. `openssl rand -hex 12`); samego tokenu nie podajemy jury ani
nie wpisujemy do repozytorium — serwer wydaje sesję demo po kliknięciu.

> Aplikacja działa w przeglądarce bez logowania: **[link do demo — PLACEHOLDER]**.
> Panel moderatora dla jury: **[link do demo]/moderator** → kliknij przycisk „Wejdź na konto demonstracyjne
> (dla jury)” — bez tokenu i hasła. To konto demonstracyjne (tak je oznaczamy w panelu):
> decyzje działają naprawdę — zatwierdzone zgłoszenie od razu zmienia kartę miejsca (link „Zobacz na karcie”
> w historii), ze źródłem „Konto demonstracyjne moderatora (zmiana tymczasowa)” — a po 30 minutach cofamy je
> automatycznie, żeby nie zmieniać danych na stałe. Przez ten czas całe miejsce ma oznaczenie „PRZYKŁAD” (na karcie,
> liście, stronie wydarzenia i w widżecie), bo źródło demonstracyjne traktujemy jak dane przykładowe. Ścieżka: otwórz
> dowolne miejsce → „To się nie zgadza” albo „Uzupełnij” → wyślij zgłoszenie → panel moderatora → w kolejce wybierz
> swoje zgłoszenie (najnowsze jest na końcu listy; kolejka zawiera też prawdziwe zgłoszenia innych osób) →
> „Zatwierdź” → „Zobacz na karcie”. Sesja konta demo trwa 12 godzin; „Wyloguj” i ponowne kliknięcie przycisku
> otwiera nową.

## Linki

- Demo: **[link do demo — PLACEHOLDER]** (wdrożenie w toku, KBB-21)
- Publiczne API i dokumentacja: **[link do demo]/api/docs — PLACEHOLDER**
- Repozytorium: **[link do repozytorium — PLACEHOLDER]** (kandydat: https://github.com/Grzmro/Krakow-bez-barier, sprawdzić dostęp publiczny)
- Film (MP4, do 3 min): **[link do filmu — PLACEHOLDER]**
- Prezentacja (PDF, 10 slajdów): **[link do PDF — PLACEHOLDER]** (eksport z https://claude.ai/artifact/CUZoLZxBkFv77dpRreWyDU)
