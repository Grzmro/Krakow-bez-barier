# Wykaz funkcji: co działa, a co wymaga dalszych prac

Materiał do oceny („Wykaz funkcji już dostępnych i elementów wymagających dalszych prac”,
[requirements.md](../requirements.md)). Stan gałęzi `main` na **4.10.2026, ok. 06:00** (ostatni
scalony PR w chwili pisania: #177). Każdy wiersz „Gotowe” ma scalony PR w repozytorium; numery US-x.y odnoszą się do
[requirements.md](../requirements.md), R1–R8 do [challenge.md](../challenge.md).

Liczby danych to odczyt **lokalnej bazy demo z 4.10.2026, ok. 05:50**, zasilonej tym samym ingestem co
wdrożenie (ostatnie udane uruchomienia: OSM z wejściami budynków 4.10.2026 01:56 UTC, Rejestr Aptek
4.10.2026 01:35 UTC, BIP Małopolska 3.10.2026 23:57 UTC, krakow.pl 3.10.2026 23:10 UTC, BIP MK 3.10.2026
22:42 UTC; tabela `ingestion_runs`).

## Dane w liczbach (4.10.2026)

| Co | Liczba | Skąd |
|---|---|---|
| Obiekty na mapie całego Krakowa | 36 956 | tabela `places` |
| … w tym lokale i instytucje (restauracje, sklepy, hotele, zabytki, apteki, toalety, muzea, teatry, inne) | 7 773 | `places` według kategorii (w tym 328 aptek) |
| … w tym infrastruktura z OSM: ławki 14 075, schody 7 507, przystanki 3 128, parkingi 2 906, krawężniki 1 406, windy 161 | — | `places` według kategorii |
| Aktywne fakty o dostępności (z pochodzeniem) | 41 966 | `facts`: OSM 41 789 (w tym 69 z wejść budynków), BIP MK 74, krakow.pl 71, BIP Małopolska 32 |
| BIP MK: strony „Dostępność architektoniczna” | 19 stron, 23 miejsca instytucji kultury | `docs/data-sources.md`, run z 3.10.2026 |
| BIP Małopolska: deklaracje dostępności | 7 wydawców, 11 budynków, 32 fakty | `docs/data-sources.md`, run z 4.10.2026 |
| krakow.pl „Toalety ogólnodostępne” | 24 z 65 toalet z listy miasta przypiętych do toalet z OSM | `docs/data-sources.md` |
| Rejestr Aptek (dane.gov.pl, CC BY 4.0) | 260 czynnych aptek: 242 przypięte do aptek z OSM, 20 nowych miejsc; 0 faktów | `docs/data-sources.md`, run z 4.10.2026 |
| Fakty o szerokości drzwi | **1** (wejście restauracji z OSM; to miejsce nie ma danych o stopniach) | `facts`, atrybut `door_width_cm` |

Wniosek z ostatniego wiersza: profile wymagają szerokości drzwi i wejścia bez stopni, a jedyne miejsce
z szerokością drzwi nie ma danych o wejściu, więc dziś żadne miejsce nie dostaje „Spełnia” na samych danych
otwartych. Uzupełnia to zgłoszenie z moderacją
([demo-script.md](../demo-script.md), scena 3; [jury-qa.md](jury-qa.md), pytanie 1). Fakty MSIP
(10 rekordów ze starego seeda) zostały w bazie, ale API ich nie podaje (KBB-133).

## Jak uruchomić prototyp

- Aplikacja webowa korzysta z **prawdziwego API** i bazy PostGIS (`DATABASE_URL`; `npm run db:setup`,
  potem `npm run ingest -- --city krakow --source <id>`). Dane przykładowe z kontraktu API
  (`NEXT_PUBLIC_API_MOCK=true`) służą tylko testom e2e.
- Cron ingest: `.github/workflows/ingest.yml`, codziennie. Wdrożenie Vercel + Neon (Postgres/PostGIS):
  `docs/deployment.md`. Link do demo: https://krakow-bez-barier.vercel.app.

## Gotowe (scalone do `main`)

### Wyszukiwanie i mapa całego miasta (E1, E6, R1, R6)

| Funkcja | US | PR |
|---|---|---|
| Start bez konta, profilu i pytań o niepełnosprawność; czysty ekran startowy z najbliższymi miejscami | US-1.1 | #20, #132, #137, #143 |
| Wyszukiwanie po nazwie z podpowiedziami i odmianą polskich słów, kategorie, szybkie filtry cech | US-1.2, US-1.3 | #20, #36, #121, #152 |
| Wyszukiwanie głosem i komendy głosowe („najbliższa toaleta / apteka / winda”), także na Androidzie | US-1.2 | #107, #122, #129 |
| Szybkie akcje: najbliższa toaleta, winda, ławka, apteka; toalety „może być nieaktualne” też widoczne | US-1.2 | #111, #162 |
| Mapa całego Krakowa: ingest całego miasta, lekki endpoint punktów, klastry z rozkładem werdyktów, ikony kategorii | US-6.1 | #80, #136, #74, #92 |
| Lista równoważna mapie: podąża za widokiem mapy, ten sam status co pinezka, ładowana stronami | US-6.1, US-6.2 | #148, #100, #85 |
| „W mojej okolicy”: serwer dostaje tylko kratkę ok. 1 km; „Szukaj w tym obszarze”, poszerzanie do 5 km i całego miasta | US-6.6 | #47, #71, #155 |
| Przycisk „Moja pozycja” na mapie, różne komunikaty błędów lokalizacji, ręczny wybór dzielnicy | US-6.6 | #139, #78 |
| Panel listy przesuwany (pasek / pół / pełny), mapa na pełny ekran na telefonie, układ desktop | US-6.1 | #70, #76, #99, #56, #72 |
| „Wstecz” zachowuje wyszukiwanie (także na Androidzie) | US-6.1 | #93, #160 |
| Nowe kategorie: apteki, sklepy („Handel”) | US-10.2 | #142, #161 |
| Wyszukiwanie wpisanej nazwy w całym mieście, mapa przelatuje do wyniku; kolejność wyników (dopasowanie nazwy, zabytki najpierw) | US-1.2 | #169, #166 |
| Kategorie jako przełączniki, animowane rozdzielanie klastrów, jeden system pól formularza | US-6.1 | #149, #168, #156 |

### Karta miejsca i profile potrzeb (E1, E2, R1, R4)

| Funkcja | US | PR |
|---|---|---|
| Karta: wejście, stopnie, próg, drzwi, podjazd, winda, kondygnacje, nawierzchnia, toaleta, przewijak, ławka, parking, ogólna dostępność — wartości bez zbiorczej oceny | US-1.4 | #16, #61 |
| Profile „Wózek”, „Wózek dziecięcy”, „Senior”; progi w przeglądarce, zmiana i przywrócenie progów | US-2.1–2.3, US-2.8 | #18, #35, #60, #81 |
| Werdykt profilu na karcie z grupami „Blokuje / Pasuje / Nie wiadomo” i licznikiem „Pasuje X z Y potrzeb” | US-2.4, US-2.5 | #105 |
| Wyjaśnienie, czemu żadne miejsce nie spełnia profilu („Najczęściej brakuje danych o: drzwi…”) | US-2.4 | #94 |
| Brak windy blokuje tylko tam, gdzie są piętra | US-2.5 | #50 |
| Kontakt do obiektu, stały link do karty, link „Edytuj w OpenStreetMap” przy faktach z OSM | US-1.6, US-1.7, US-4.7 | #16, #68 |
| Najbliższe odjazdy z dostępnością pojazdów (ZTP GTFS-RT) i reguła konfliktu taboru — **wyłączone na produkcji do potwierdzenia licencji ZTP** | — | #69, #126 |

### Wiarygodność danych (E3, R2)

| Funkcja | US | PR |
|---|---|---|
| Przy każdej cesze źródło, data pozyskania, data stanu według źródła, status; cytat zdania i link do strony źródła (BIP, krakow.pl) | US-3.1 | #16, #123 |
| „Niezweryfikowane” i „niepotwierdzone” jako tekst | US-3.2 | #16, #35 |
| „Sprzeczne”: obie wartości ze źródłem i datą, nigdy „Spełnia”; „Może być nieaktualne” po 12 miesiącach | US-3.3, US-3.5 | #21, #36 |
| Brak danych nigdy jako dostępność (testy jednostkowe), także na trasie | US-3.4 | #21, #103 |
| Status źródeł, awaria źródła z ostatnią kopią i datą, przełącznik operatora `SIMULATE_SOURCE_OUTAGE` | US-3.6, US-5.4 | #37 |
| Przełącznik „Demo źródeł” w panelu moderatora (także konto demo): symulowana awaria wybranego źródła na 15 min, oznaczona „Tryb demo” | US-3.6 | #171 |
| Raport jakości danych `/o-danych/jakosc` i `GET /data-quality`: pokrycie według kategorii i cech, wiek faktów, wiarygodność, konflikty | US-3.8 | #177 |
| Prawdziwe 404 dla nieznanych miejsc, tytuły stron; fakty na liście jako „cecha: wartość”; mniej tekstu na kluczowych ekranach | US-1.4 | #164, #163, #173 |
| Oznaczenie „PRZYKŁAD” przy każdym przykładowym miejscu i fakcie (stały baner usunięty, bo demo działa na prawdziwych danych) | US-3.7 | #9, #110 |
| Strona „O danych”: źródła, licencje i ich stan po polsku, atrybucja, powód wyłączenia MSIP | US-3.8 | #17, #89, #128 |

### Zgłoszenia, potwierdzenia, moderacja (E4)

| Funkcja | US | PR |
|---|---|---|
| „To się nie zgadza”, „Uzupełnij”, „Nadal aktualne” (dawniej „Potwierdzam, byłem tu”); bez konta; pole liczbowe z zakresem | US-4.1–4.3 | #26, #38, #81 |
| Jedno oczekujące zgłoszenie na urządzenie i cechę („Zmień”, „Wycofaj”), bez duplikatów | US-4.1 | #145 |
| Oczekujące zgłoszenia widoczne na karcie jako „Niezweryfikowane”; nie zmieniają danych | US-4.1 | #58 |
| Walidacja zakresów, limity na klienta, pułapka na boty, usuwanie e-maili i telefonów z komentarzy | US-4.5 | #38 |
| Zgłoszenie awarii windy lub podjazdu, potwierdzane przez innych; moderator je usuwa | US-4.1 | #75, #95, #104 |
| Panel moderatora: kolejka, zatwierdź / odrzuć / do wyjaśnienia, historia, link „Zobacz na karcie”; poza publiczną nawigacją | US-4.4 | #38, #42, #77 |
| Konto demonstracyjne moderatora dla jury jednym kliknięciem (także z panelu miasta); jego decyzje są oznaczone „PRZYKŁAD” i cofają się po 30 minutach | US-4.4 | #64, #97, #153 |
| Potwierdzenie „Nadal aktualne”: liczą się potwierdzenia z ostatnich 90 dni, dwa podnoszą fakt do „Potwierdzone”; osobna linia pochodzenia na karcie | US-4.3, US-3.1 | #176 |
| Arkusz zgłoszenia mieści się nad klawiaturą iPhone’a | US-8.1 | #133, #134, #141, #151 |

### Dane i architektura (E5, R3, R5)

| Funkcja | US | PR |
|---|---|---|
| Ingest jako osobna aplikacja: adapter na źródło, dziennik uruchomień, ostatnia dobra kopia; zapasowo ekstrakt Geofabrik, gdy Overpass zawodzi | US-5.3–5.6 | #30, #37, #57 |
| OSM: miejsca, ławki, windy, parkingi, schody, krawężniki | US-5.1 | #30, #119 |
| OSM: wejścia budynków (`entrance=*`: dostępność, szerokość, drzwi automatyczne) przypięte do miejsc | US-5.1 | #174 |
| Rejestr Aptek (dane.gov.pl, CC BY 4.0): apteki brakujące w OSM, adresy aptek z OSM; bez faktów o dostępności | US-5.2 | #170 |
| OSM: przystanki z platform (ścieżka dotykowa, wiata, ławka) zamiast warstwy ZTP bez licencji | US-5.1 | #146 |
| BIP Miasta Krakowa: „Dostępność architektoniczna” jednostek miejskich, fakty z cytatem | US-5.2 | #123 |
| BIP Małopolska: deklaracje dostępności 7 wydawców, licencja sprawdzona dla każdego | US-5.2 | #140 |
| krakow.pl „Toalety ogólnodostępne” (licencja niekomercyjna, oznaczona); MSIP wyłączone jako nieotwarte | US-5.2 | #128 |
| Bramka licencyjna w ingest i API: źródło „do potwierdzenia” nie trafia na żaden ekran | US-5.2 | #41, #128 |
| GUS BDL na panelu miasta (osoby z niepełnosprawnością, wiek poprodukcyjny, muzea przystosowane) | US-5.2 | #114 |
| Miasto i kategoria jako konfiguracja (Wrocław na samym OSM) | US-10.1, US-10.2 | #39 |

### Trasy (E7)

| Funkcja | US | PR |
|---|---|---|
| `POST /routes` przez openrouteservice (profil wózka, „Unikaj schodów”, zapas: najkrótsza z barierami) | E7 | #51 |
| Odcinki z nawierzchnią, schodami, nachyleniem i krawężnikami ze źródłem; „brak danych” i „sprzeczne” na odcinkach, nigdy zielone | E7 | #51, #103 |
| Start z własnej pozycji albo z dowolnego miejsca, bez cichego Dworca Głównego | E7 | #101, #131 |
| „Ruszamy”: prowadzenie krok po kroku | E7 | #84 |
| „Czytaj na głos”: kroki trasy, w trakcie prowadzenia tylko to, co ważne w danej chwili | E7 | #125, #158 |
| Zapisane trasy dostępne offline | E7 | #116 |
| „Prowadź do X” z wyszukiwarki; panel trasy zwijany na telefonie; trasa mieści się nad panelem | E7 | #124, #127, #159 |

### Partnerzy i kanały (E9, R8)

| Funkcja | US | PR |
|---|---|---|
| Widżet `/widget/{placeId}` (`<iframe>`) zaczynający od znanych faktów; strona „Dla firm” z kodem do wklejenia i prawdziwym hotelem | US-9.1 | #25, #43, #91, #157 |
| Strona wydarzenia „Dojazd i wejście bez barier” z najbliższymi przystankami i ich faktami | US-9.4 | #49, #150 |
| Publiczne API tylko do odczytu (OpenAPI 3.1), CORS, nagłówki licencji, limity, dokumentacja `/api/docs` | US-9.2 | #29, #36, #43 |
| Panel miasta `/miasto`: statystyki barier i priorytety napraw, GUS BDL | — | #73, #114 |
| PWA z trybem offline; aplikacja iOS/Android (Capacitor) z tego samego kodu | — | #22, #23, #33, #34 |

### Dostępność cyfrowa (E8, R6)

| Funkcja | US | PR |
|---|---|---|
| Klawiatura, widoczny fokus, „Przejdź do treści”, ogłaszanie zmian, ruch ograniczony przy `prefers-reduced-motion` | US-8.1, US-8.2 | #9, #20, #147 |
| Audyt axe (WCAG 2.2 A/AA) i snapshot ARIA w e2e każdego ekranu, telefon i desktop (e2e uruchamiane lokalnie przed scaleniem, nie w CI) | US-8.1–8.3 | #10, #118 |
| Deklaracja dostępności, strona „Prywatność” | US-8.5 | #17, #65 |
| Wersja angielska (przełącznik PL/EN); teksty ze źródeł oznaczone `lang="pl"` | US-8.6 | #52, #165 |

## W toku (4.10.2026, ok. 06:00)

| Element | Zadanie |
|---|---|
| Spójny werdykt wejścia na karcie, gdy wejście z poziomu gruntu pochodzi z BIP, a liczby stopni brak (Hangar Czyżyny) | KBB-193 |
| Udostępnianie miejsca lub trasy opiekunowi (Web Share + QR) | KBB-192 (PR #179) |

Film demo (KBB-31) jest gotowy: `kbb-demo.mp4`, 2:51, odświeżony w KBB-181 (#175).

## Wymaga dalszych prac

| Element | Dlaczego | Zadanie |
|---|---|---|
| Szerokość drzwi i stopnie dla większości miejsc | w otwartych źródłach prawie ich nie ma (1 fakt o drzwiach, 35 miejsc z konkretem o wejściu); potrzebne zgłoszenia, weryfikacje obiektów i panel właściciela | — |
| Ładowanie warstw ZTP (przystanki, GTFS-RT) i ZDMK (parking OZN) | licencje do potwierdzenia z miastem; adaptery gotowe | KBB-20 |
| krakow.pl do użytku komercyjnego | licencja tylko niekomercyjna; potrzebna zgoda miasta | — |
| Panel właściciela obiektu (US-9.3), zdjęcia w zgłoszeniach (US-4.6) | wartość dodana, nie zaczęte | — |
| Retencja zgłoszeń 24 mies. (deklarowana na stronie „Prywatność”) | brak automatycznego usuwania w kodzie | — |
| Testy z użytkownikami czytników ekranu, zewnętrzny audyt WCAG 2.2 AA, audyt licencji zależności | wymaga ludzi i czasu poza hackathonem | — |
