# Scenariusz demo

Dwa scenariusze z tymi samymi scenami:

1. **[Pokaz na żywo dla jury](#pokaz-na-żywo-dla-jury)** (3:00, osoba na wózku): klik po kliku,
   z planem B dla każdej sceny. Pokazuje pętlę „Uzupełnij → konto demo moderatora → Zatwierdź → nowy
   fakt”, stan „Sprzeczne” i awarię źródła. Odpowiedzi na pytania jury są w
   [submission/jury-qa.md](submission/jury-qa.md).
2. **[Wideo do zgłoszenia](#wideo-do-zgłoszenia)** (KBB-31, KBB-181): MP4 2:49 z polskimi napisami,
   nagrywane automatycznie przez Playwright (`npm run demo:record`); lektora można dograć.

## Pokaz na żywo dla jury

Grupa docelowa: **osoba na wózku** (profil „Wózek”). Stan danych i sprawdzenia: 4.10.2026, ok. 03:20,
API buildu produkcyjnego na lokalnej bazie demo (ten sam ingest co wdrożenie). Na wdrożeniu przećwicz
każdą scenę jeszcze raz, bo identyfikatory miejsc są tam inne.

### Przygotowanie (przed wejściem na salę)

- [ ] `GET <demo>/api/v1/health` zwraca „database up”. `/o-danych` pokazuje źródła OSM, BIP MK,
      BIP Małopolska i krakow.pl jako działające, a MSIP jako „Wyłączone” z powodem.
- [ ] Na Vercelu są ustawione `MODERATOR_DEMO_TOKEN` (bez niego na `/moderator` nie ma przycisku
      „Wejdź na konto demonstracyjne (dla jury)”) i `ORS_API_KEY` (bez niego trasa kończy się
      komunikatem o braku klucza).
- [ ] W `/moderator` odrzuć zgłoszenia z prób. Decyzje konta demo i fakty, które z nich powstały,
      i tak cofają się same po 30 minutach (`DEMO_REVERT_MINUTES`).
- [ ] **10–25 minut przed pokazem przygotuj „Sprzeczne”** (scena 4; zmiana konta demo trwa 30 minut):
      karta toalety w Sukiennicach (wyszukaj „Toaleta”, pinezka przy Sukiennicach; OSM
      `node/3533569749`) → „To się nie zgadza” → „Ogólna dostępność” → „Dostępne dla wózków” →
      „Wyślij” → `/moderator` → „Zatwierdź”. Sprawdź, że wiersz „Ogólna dostępność” na karcie ma
      teraz stan „Sprzeczne”.
- [ ] Otwarte karty przeglądarki: (1) ekran główny, (2) `/moderator` zalogowany kontem demo,
      (3) karty miejsc na plan B: Hangar Czyżyny, Wojewódzka Biblioteka Publiczna, toaleta
      w Sukiennicach, (4) awaria źródła (scena 5), (5) `/dla-firm`, (6) `/api/docs`.
- [ ] Lokalizacja: ekran trasy bez wybranego startu sam próbuje ustalić pozycję. Zdecyduj wcześniej
      w ustawieniach przeglądarki (zezwól albo zablokuj dla adresu demo), żeby na sali nie wyskoczyło
      pytanie o zgodę; start i tak wybieramy ręcznie (scena 6).
- [ ] Profil w przeglądarce wyłączony (wybieramy go na żywo). Telefon albo okno przeglądarki
      w szerokości telefonu; Wi-Fi sprawdzone (kafelki mapy idą z OpenFreeMap).

### Sceny

| Czas | Scena | Klik po kliku | Co mówimy | Plan B |
|---|---|---|---|---|
| 0:00–0:15 | **1 · Dla kogo** | Ekran główny → przełącznik profilu → „Wózek”. | „Pani Anna jeździ na wózku. Chce wiedzieć, czy wjedzie, zanim wyjdzie z domu. Nie zakłada konta. Profil to tylko progi: bez stopni, drzwi co najmniej 90 cm, winda, toaleta. Zostaje w przeglądarce.” | Przełącznik nie reaguje: odśwież stronę i wybierz profil jeszcze raz. Progi pokażesz w oknie „Progi profilu”. |
| 0:15–0:45 | **2 · Miejsce i źródło** | W polu „Dokąd?” wpisz **„Hangar”** → Enter → „Hangar Czyżyny Oddział Muzeum Inżynierii Miejskiej” → karta. Werdykt „Brak danych · drzwi”, „Pasuje 3 z 4 potrzeb profilu”. Rozwiń „Winda”: cytat z BIP, „stan na 19.03.2026 wg źródła”, link do strony BIP. | „Werdykt jest słowem, nie kolorem. Wejście z poziomu gruntu, winda i toaleta pochodzą z deklaracji dostępności w BIP Miasta. Przy każdej informacji jest cytat, link i data. Brakuje jednego faktu: szerokości drzwi. Dlatego nie mówimy »dostępne«.” | Wyszukiwanie daje „0 miejsc”: do czasu KBB-178 wyszukiwanie po nazwie przeszukuje tylko widok mapy. Oddal mapę tak, żeby objęła Czyżyny, i wyszukaj jeszcze raz, albo otwórz kartę z przygotowanej zakładki. Zamiennik: „Wojewódzka Biblioteka Publiczna w Krakowie” (Rajska 1; BIP Małopolska z 31.03.2026: podjazd, winda, toaleta; też brakuje tylko drzwi). |
| 0:45–1:30 | **3 · Uzupełnij → Zatwierdź** | Na karcie „Uzupełnij” → „Która cecha?” → „Szerokość drzwi” → wpisz **90** → „Wyślij”. Na karcie: „Twoje zgłoszenie”, „Czeka na weryfikację — nie zmienia danych powyżej”. Zakładka `/moderator` (konto demo) → w kolejce ostatnie zgłoszenie (najnowsze jest na końcu) → „Zatwierdź” → w historii „Zobacz na karcie”. | „Ktoś zmierzył drzwi. Zgłoszenie bez konta i bez e-maila trafia do moderatora i do tego czasu nie zmienia danych. Moderator zatwierdza. Na karcie jest nowy fakt ze źródłem i datą, a profil Wózek dostaje werdykt »Spełnia«. To jest konto demonstracyjne: zmiana jest oznaczona »PRZYKŁAD« i cofnie się sama po 30 minutach.” | Brak przycisku konta demo (nie ustawiono `MODERATOR_DEMO_TOKEN`): pokaż zgłoszenie „Czeka na weryfikację” na karcie i fragment wideo albo zrzut panelu. Werdykt inny niż „Spełnia”: przeczytaj z grup „Blokuje / Pasuje / Nie wiadomo” na karcie, której potrzeby brakuje. Oczekiwany wynik wynika z Matchera (wejście, winda i toaleta spełnione, „niepotwierdzone”), ale trzeba go przećwiczyć na wdrożeniu. |
| 1:30–1:50 | **4 · Sprzeczne** | Karta toalety w Sukiennicach (przygotowana wcześniej) → rozwiń „Ogólna dostępność”: stan „Sprzeczne”, obok siebie zatwierdzone zgłoszenie „Dostępne dla wózków” i OpenStreetMap „Częściowo dostępne dla wózków”, a niżej lista miasta z krakow.pl „Może być nieaktualne · 15.09.2025”. | „Gdy dwa aktualne źródła się nie zgadzają, nie wybieramy za użytkownika. Pokazujemy obie wartości ze źródłem i datą, i nigdy nie dajemy wtedy »Spełnia«. Lista miasta ma ponad rok, więc jest oznaczona jako możliwie nieaktualna.” | Przygotowanie się nie udało albo minęło 30 minut: pokaż tę samą toaletę bez zgłoszenia (krakow.pl „Może być nieaktualne”, OSM obok) i powiedz regułę: fakt starszy niż 12 miesięcy ustępuje świeżemu, a dwa świeże różne fakty to „Sprzeczne”. |
| 1:50–2:10 | **5 · Awaria źródła** | **Gdy jest KBB-179:** `/moderator` → „Symuluj awarię źródła” → krakow.pl → „O danych”: krakow.pl „Niedostępne” z notką „Symulowana awaria źródła (przełącznik testowy). Pokazujemy ostatnie znane dane jako nieaktualne.”; karta toalety: „Odświeżenie nie powiodło się — dane z …”, fakty krakow.pl oznaczone jako nieaktualne, reszta działa. Wyłącz przełącznik. **Bez KBB-179:** zakładka z wdrożeniem z `SIMULATE_SOURCE_OUTAGE=krakow-pl-toilets` i `ALLOW_SIMULATED_OUTAGE=true` (`docs/deployment.md` pkt 7). | „Miejskie serwisy czasem nie odpowiadają. Wtedy nic nie znika: zostaje ostatnia dobra kopia z datą, a aplikacja mówi wprost, że źródło jest niedostępne. Tu awaria jest symulowana i tak też jest opisana.” | Nie ma ani przełącznika, ani drugiego wdrożenia: scena „Źródło niedostępne” z wideo (KBB-31) albo zrzut. Na głównym wdrożeniu nie zmieniaj zmiennych w trakcie pokazu. |
| 2:10–2:30 | **6 · Trasa** | Na karcie toalety „Prowadź” → pole „Start” → „Dworzec Główny” (jeśli pojawi się komunikat o braku startu albo lokalizacji, zamknij go i wybierz start ręcznie). Podsumowanie trasy z barierami i brakami danych na odcinkach, „Krok po kroku”, „Czytaj na głos”. | „Trasa ma te same zasady co karta. Odcinek bez danych nigdy nie jest pokazany jako spełniający potrzeby. Na tej trasie nie znamy barier, ale znaczną część drogi opisujemy jako »bez danych«. »Krok po kroku« to tekstowa wersja mapy, którą można odsłuchać.” | W ocenie z 4.10 ta trasa dała „Brak znanych barier, ale 1,6 km bez danych · brak danych na 26 odcinkach (1572 m)”; liczby mogą się zmienić, czytaj z ekranu. Komunikat o braku klucza ORS: pomiń scenę i powiedz, że trasa działa po stronie serwera z kluczem openrouteservice. Nie używaj „Moja lokalizacja”, bo lokalizacja na sali może nie zadziałać. |
| 2:30–2:50 | **7 · Dla firm i model** | `/dla-firm`: podgląd widżetu hotelu, kod `<iframe>` do wklejenia, generator strony wydarzenia „Dojazd i wejście bez barier” (z najbliższymi przystankami), blok „Odpowiedź API dla tego hotelu”; potem zakładka `/api/docs`. | „Hotel osadza tę kartę na swojej stronie jednym kodem, organizator generuje stronę wydarzenia, a systemy rezerwacji biorą te same dane z API, ze źródłem i licencją. Płacą obiekty i partnerzy, za kartę i weryfikację. Mieszkańcy i turyści korzystają za darmo.” | Widżet się nie ładuje: pokaż `/api/docs` albo kartę wydarzenia otwartą z zakładki. |
| 2:50–3:00 | **8 · Zakończenie** | Klawisz Tab na ekranie głównym: „Przejdź do treści”, widoczny fokus; lista obok mapy. | „Całość działa z klawiatury, statusy są tekstem, a lista jest pełną wersją mapy. Usługę prowadzi niezależny operator, nie Urząd. Kolejne miasto to konfiguracja. Kraków bez barier: fakty, źródło przy każdej informacji, otwarte dane.” | Brak czasu: pomiń Tab i powiedz tylko ostatnie zdanie. |

### Pokrycie oceny jury (pokaz na żywo)

| Punkt z [challenge.md](challenge.md) | Scena |
|---|---|
| Grupa docelowa i potrzeby; sprawdzenie miejsca; konkretne bariery i udogodnienia | 1, 2 |
| Pochodzenie: źródło, data, wiarygodność; dane niepełne, nieaktualne, niezweryfikowane | 2 (cytat, data, „niepotwierdzone”), 3 („Czeka na weryfikację”), 4 („Może być nieaktualne”) |
| Przypadek awarii: sprzeczne, niepełne, niedostępne źródło; brak danych ≠ dostępne | 2 (brak danych o drzwiach), 4 (sprzeczne), 5 (awaria źródła), 6 (odcinki bez danych) |
| Poprawianie błędnych danych | 3 |
| Dane przykładowe oznaczone | 3 (zmiana konta demo ma oznaczenie „PRZYKŁAD”) |
| Dostępność cyfrowa głównego scenariusza | 6 („Krok po kroku”), 8 |
| Prototyp → usługa | 7, 8, pytania w [jury-qa.md](submission/jury-qa.md) |

## Wideo do zgłoszenia

Wideo do zgłoszenia (KBB-31, odświeżone w KBB-181): te same sceny co pokaz na żywo, dla osoby na wózku.
Nagranie robi Playwright, bez lektora: 1920×1080, aplikacja na ekranie desktopowym, pod nią pasek z polskim
napisem (wypalony w obrazie, więc widać go w każdym odtwarzaczu), krótki fragment w ramce telefonu.

**Dwa serwery, żeby nagranie niczego nie zostawiło w bazie:**

- **Prawdziwe dane** (sceny 1, 2, 6, 7, 8): miejsca z OpenStreetMap, fakty z BIP Miasta Krakowa, trasa
  z openrouteservice — z bazy, na której działa aplikacja. Te sceny tylko czytają; nagranie sprawdza, że
  nie ma na nich etykiety „PRZYKŁAD”.
- **Dane przykładowe** (sceny 3–5): „Uzupełnij”, zatwierdzenie na koncie demo moderatora, „Sprzeczne”
  i przełącznik awarii źródła działają na przykładowym API (`next dev` z `NEXT_PUBLIC_API_MOCK=true`).
  Na prawdziwej bazie zgłoszenie zostaje na stałe (po cofnięciu decyzji konta demo wraca do kolejki),
  a przełącznik awarii zmienia stan widoczny dla wszystkich. Na ekranie jest wtedy „PRZYKŁAD”, a pasek
  napisów ma plakietkę „PRZYKŁAD · dane przykładowe”.

### Jak nagrać

```bash
npm run db:setup                      # migracje + seed
npm run ingest -- --city krakow --source osm          # miejsca z OpenStreetMap
npm run ingest -- --city krakow --source bip-mk       # fakty z BIP MK (Hangar Czyżyny)
npm run demo:record                   # build bez mocka + `next start`, `next dev` z przykładowym API, nagranie
DEMO_PACE=0.2 npm run demo:record     # szybki przebieg kontrolny (krótsze pauzy)
E2E_BASE_URL=http://127.0.0.1:3100 DEMO_OUT_DIR=/tmp/video npm run demo:record   # na działającym serwerze
```

- Wynik w `apps/web/demo-output/` (albo w `DEMO_OUT_DIR`): `kbb-demo.mp4` (H.264, 1920×1080, napisy
  w obrazie i dodatkowo jako ścieżka napisów `pol`), `kbb-demo.srt`, `kbb-demo.webm` (surowe nagranie)
  i `axe.json`. MP4 powstaje, gdy jest `ffmpeg`; bez niego zostaje WebM, a test wypisuje komendę konwersji
  (`ffmpeg -i kbb-demo.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart kbb-demo.mp4`).
- Test kończy się błędem, gdy przejście trwa dłużej niż 3:00. W konsoli wypisuje czas każdego napisu.
  Napis zostaje na ekranie co najmniej tyle, ile trwa jego przeczytanie (ok. 20 znaków na sekundę).
- **Dostępność w trakcie nagrania:** na 13 ekranach (każda scena) axe sprawdza WCAG 2.2 A/AA ramki
  aplikacji; wynik w `axe.json`, test kończy się błędem przy każdym naruszeniu. Nagranie 4.10.2026:
  0 naruszeń.
- **Baza jest wymagana.** Bez `DATABASE_URL` (albo `E2E_BASE_URL`) nagranie nie startuje, a gdy baza
  nie odpowiada albo brakuje miejsca, kończy się błędem na starcie — sceny na prawdziwych danych nigdy
  nie przechodzą po cichu na przykładowe dane. Build ma zawsze `NEXT_PUBLIC_API_MOCK` puste.
- Miejsce sceny 2 jest wyszukiwane w API po nazwie, nie po identyfikatorze (`PLACES` w skrypcie);
  przykładowe miejsca scen 3–5 pochodzą z `openapi.yaml` (`SAMPLE`).
- Serwer z przykładowym API startuje na własnym porcie worktree; `DEMO_SAMPLE_BASE_URL` wskazuje inny.
- Skrypt: `apps/web/e2e/demo/record-demo.ts` (osobna konfiguracja `playwright.demo.config.ts`, poza
  `npm run test:e2e`).

### Miejsca w scenariuszu

Stan danych z nagrania 4.10.2026 (lokalna baza demo, ten sam ingest co wdrożenie).

| Scena | Miejsce | Dane | Co mówią dane |
|---|---|---|---|
| 2 · Miejsce i źródło | **Hangar Czyżyny Oddział Muzeum Inżynierii Miejskiej** | prawdziwe | BIP MK „Dostępność architektoniczna” (stan na 19.03.2026): wejście, winda, toaleta, parking, przewijak z cytatem i linkiem; szerokości drzwi brak. Werdykt „Brak danych · drzwi”, „Pasuje 3 z 4 potrzeb profilu”. |
| 3 · Uzupełnij | **Kawiarnia Przykład** (`kawiarnia-przyklad`) | przykładowe | Prawie wszystko „Brak danych”; zgłoszenie „Szerokość drzwi: 90 cm” czeka na weryfikację. |
| 3 · Zatwierdź | kolejka przykładowa: **Podziemia Rynku · Winda → Nie ma** | przykładowe | „Co się zmieni na karcie”: teraz „Jest” (OSM), po zatwierdzeniu „Nie ma”, źródło „Konto demonstracyjne moderatora (zmiana tymczasowa)”. Przykładowe API nie przenosi zgłoszenia z karty do kolejki, więc zatwierdzamy zgłoszenie z przykładowej kolejki; napisy nie twierdzą, że to to samo. |
| 4 · Sprzeczne | **Pałac Krzysztofory** (`palac-krzysztofory`) | przykładowe | Toaleta: MSIP „Jest”, OSM „Nie ma” → „Sprzeczne”, obie wartości z datami. |
| 5 · Awaria źródła | przełącznik konta demo (OpenStreetMap) → „O danych” → **Hotel Przykład** | przykładowe | „Niedostępne”, „Odświeżenie nie powiodło się — dane z 3.10.2026”, „Tryb demo”; na końcu sceny „Wyłącz”. |
| 6 · Trasa | Dworzec Główny → Hangar Czyżyny, „Unikaj schodów” | prawdziwe | openrouteservice + fakty OSM: „Brak znanych barier, ale 4,3 km bez danych”, „Najkrótsza: Nie spełnia · schody”. |
| 7 · Dla firm | widget, strona wydarzenia i odpowiedź API dla **Hangaru**; `/api/docs` | prawdziwe | Ta sama karta co w aplikacji, z tymi samymi źródłami i datami. |
| 8 · Telefon | karta **Hangaru** w ramce telefonu (390×844) | prawdziwe | Ten sam układ telefonu co w PWA i aplikacjach (Capacitor). |

### Scenariusz

Grupa docelowa: **osoba na wózku** (profil „Wózek”). Czasy z nagrania 4.10.2026 (MP4 2:49; ostatni napis
od 2:39, potem kilka sekund ostatniego kadru). Kolumna „Napis” to dokładny tekst z wideo i z `kbb-demo.srt`;
lektor może go czytać.

| Czas | Scena | Co widać | Napis |
|---|---|---|---|
| 0:00 | 1 · Dla kogo | Strona główna: mapa, lista najbliżej Rynku, szybkie akcje | Pani Anna jeździ na wózku. Chce wiedzieć, czy wjedzie, zanim wyjdzie z domu. Bez konta. |
| 0:05 | 1 · Dla kogo | Przełącznik profilu → „Wózek” | Wybiera profil „Wózek”: same progi — stopnie, drzwi, winda, toaleta. Profil zostaje w przeglądarce. |
| 0:11 | 2 · Miejsce i źródło | Wpisanie „Hangar”, Enter: 1 miejsce na liście i na mapie | Szuka „Hangar”. Prawdziwe miejsca z OpenStreetMap i deklaracji dostępności w BIP. |
| 0:16 | 2 · Miejsce i źródło | Wiersz „Brak danych · drzwi”, podsumowanie „Najczęściej brakuje danych o: drzwi” | Werdykt jest słowem, nie kolorem: „Brak danych · drzwi”. Brak danych nigdy nie znaczy „dostępne”. |
| 0:23 | 2 · Miejsce i źródło | Karta: „Twój profil: Wózek”, grupy „Pasuje (3)” i „Nie wiadomo (1)”, „Skąd wiemy?” z BIP MK | Karta: pasuje 3 z 4 potrzeb profilu. Wejście, winda i toaleta są w BIP; szerokości drzwi nie podaje nikt. |
| 0:30 | 2 · Miejsce i źródło | Rozwinięta „Winda”: źródło BIP MK, „stan na 19.03.2026 wg źródła”, cytat, „Strona źródła” | Przy każdej cesze: źródło, cytat ze strony BIP, data stanu i link. Jedno źródło — „Niezweryfikowane”. |
| 0:37 | 3 · Uzupełnij | **PRZYKŁAD**: karta Kawiarni Przykład | Zapis pokazujemy na danych przykładowych (PRZYKŁAD), żeby nagranie nie zmieniło prawdziwej bazy. |
| 0:43 | 3 · Uzupełnij | „Uzupełnij” → „Szerokość drzwi” → 90 → „Wyślij” | Ktoś zmierzył drzwi: „Uzupełnij” → „Szerokość drzwi” → 90 cm. Bez konta i bez e-maila. |
| 0:49 | 3 · Uzupełnij | „Twoje zgłoszenie: 90 cm”, toast „Czeka na weryfikację” | Zgłoszenie czeka na moderatora. Do tego czasu nie zmienia danych na karcie. |
| 0:54 | 3 · Zatwierdź | `/moderator` → „Wejdź na konto demonstracyjne (dla jury)”, ramka „Konto demonstracyjne” | Jury może wejść na konto demonstracyjne moderatora jednym przyciskiem. |
| 0:58 | 3 · Zatwierdź | „Co się zmieni na karcie”: Teraz „Jest” (OSM) → Po zatwierdzeniu „Nie ma” | Moderator widzi, co zmieni się na karcie: teraz „Jest” z OpenStreetMap, po zatwierdzeniu „Nie ma”. |
| 1:05 | 3 · Zatwierdź | „Zatwierdź” → „Historia zmian”: „Konto demonstracyjne ·” | Decyzja trafia do historii. Konto demo cofa każdą zmianę samo po 30 minutach. |
| 1:10 | 4 · Sprzeczne | **PRZYKŁAD**: Pałac Krzysztofory, „Toaleta dostosowana: Jest / Nie ma · Sprzeczne”, rozwinięte oba źródła z datami | Dwa źródła się nie zgadzają? Nie wybieramy za użytkownika: „Sprzeczne” i obie wartości z datami. |
| 1:18 | 5 · Awaria źródła | **PRZYKŁAD**: zakładka „Demo źródeł” → „Symuluj awarię” (OpenStreetMap) | Symulujemy awarię źródła przełącznikiem konta demo. Wyłączy się sama po 15 minutach. |
| 1:24 | 5 · Awaria źródła | „O danych”: OpenStreetMap „Niedostępne”, „Odświeżenie nie powiodło się — dane z …”, „Tryb demo” | Nic nie znika: zostaje ostatnia dobra kopia z datą, a aplikacja mówi wprost „Niedostępne”. |
| 1:30 | 5 · Awaria źródła | Karta Hotelu Przykład z banerem awarii | Na karcie: „Odświeżenie nie powiodło się”, fakty oznaczone jako możliwie nieaktualne. |
| 1:36 | 5 · Awaria źródła | „Wyłącz symulowaną awarię” → „Żadna symulacja nie trwa” | Wyłączamy symulację — źródło znów działa. |
| 1:39 | 6 · Trasa | Trasa do Hangaru, pole „Start” → „Dworzec Główny” | Trasa z Dworca Głównego do hangaru, z profilem Wózek. Wyznacza ją openrouteservice. |
| 1:43 | 6 · Trasa | „79 min · 5,8 km”, „Brak znanych barier, ale 4,3 km bez danych”, pasek odcinków, „Najkrótsza: Nie spełnia · schody” | Odcinek bez danych nigdy nie jest „spełnia”: „Brak znanych barier, ale 4,3 km bez danych”. Wariant „Najkrótsza” ma schody. |
| 1:50 | 6 · Trasa | „Czytaj na głos” → „Czytany krok: 1 z …” → „Następny krok” → „Zakończ czytanie” | „Krok po kroku” to tekstowa wersja mapy. „Czytaj na głos” czyta po jednym kroku. |
| 1:59 | 6 · Trasa | „Ruszamy” → „Prowadzenie”: krok, odcinek, „Następny krok” | „Ruszamy” prowadzi krok po kroku — także bez zgody na lokalizację, przyciskami. |
| 2:07 | 7 · Dla firm | `/dla-firm`: widget Hangaru na „strona-hotelu.example”, kod `<iframe>` | Obiekt osadza aktualną kartę na swojej stronie jednym kodem — te same fakty, źródła i daty. |
| 2:13 | 7 · Dla firm | Generator strony wydarzenia, potem strona „Piknik lotniczy” (wejście, toaleta, parking, przystanki w pobliżu) | Organizator generuje stronę „Dojazd i wejście bez barier”, a systemy biorą dane z API. |
| 2:23 | 7 · Model | `/api/docs` (Scalar) | Płacą obiekty i partnerzy — za kartę i weryfikację. Mieszkańcy i turyści korzystają za darmo. |
| 2:28 | 8 · Telefon | Karta Hangaru w ramce telefonu | Na telefonie to samo: aplikacja webowa, PWA i aplikacje na Androida i iOS. |
| 2:33 | 8 · Zakończenie | Strona główna, Tab: „Przejdź do treści” z widocznym fokusem | Całość działa z klawiatury, statusy są tekstem, lista to pełna wersja mapy. Prowadzi niezależny operator. |
| 2:39 | Zakończenie | Strona główna | Konkretne fakty, źródło przy każdej informacji, otwarte dane. Dziękujemy! |

### Pokrycie oceny jury (wideo)

Punkty z [challenge.md](challenge.md) → „How the jury will evaluate it”.

| Punkt jury | Sceny |
|---|---|
| Grupa docelowa i jej potrzeby | 1 (osoba na wózku, profil jako progi, bez pytań o niepełnosprawność) |
| Sprawdzenie miejsca, konkretne bariery i udogodnienia | 2 |
| Pochodzenie danych: źródło, data, wiarygodność | 2 (cytat BIP, data stanu, link), 4, 5 („O danych”) |
| Oznaczenie danych niepełnych, nieaktualnych, niezweryfikowanych | 2 (brak danych o drzwiach, niezweryfikowane), 3 („Czeka na weryfikację”), 5 (możliwie nieaktualne) |
| Przypadek awarii: sprzeczne, niepełne, niedostępne źródło; brak informacji ≠ dostępność | 2 (niepełne), 4 (sprzeczne), 5 (niedostępne źródło), 6 (odcinki bez danych) |
| Poprawianie błędnych danych | 3 (zgłoszenie i moderacja) |
| Dane przykładowe oznaczone | 3–5 („PRZYKŁAD” w aplikacji i na pasku napisów) |
| Kontrola dostępności: klawiatura, czytnik ekranu, kontrast, mapa jako tekst; ograniczenia i plan | 6 („Krok po kroku”, czytanie na głos), 8; axe na każdym ekranie nagrania |
| Prototyp → usługa: właściciel, dane, hosting, plan, kolejne miasto | 7 (kto płaci), 8 (operator), szczegóły w [jury-qa.md](submission/jury-qa.md) |

### Kontrola dostępności głównego scenariusza

Automatycznie, w `npm run test:e2e` — `apps/web/e2e/main-scenario-a11y.spec.ts`:

- cały scenariusz samą klawiaturą (wyszukanie → profil → „Progi profilu” i Escape → karta → fakt →
  formularz zgłoszenia, Escape → zgłoszenie wysłane przyciskiem „Wyślij”), axe WCAG 2.2 A/AA na
  każdym kroku; fokus wraca do przycisku, który otworzył okno, po każdym jego zamknięciu;
- każda pinezka mapy ma wiersz na liście z tym samym statusem (mapa jako tekst);
- ekrany ze scenariusza przy powiększeniu 200% (640×400) i szerokości 320 px: bez przewijania
  w poziomie, axe bez błędów (w tym kontrast).

Te testy działają na przykładowych miejscach ze specyfikacji API (serwer deweloperski w trybie mock).
Te same ekrany na prawdziwych danych sprawdzają `places-real-data.prod.spec.ts` i
`business-real-data.prod.spec.ts` (`E2E_PROD=1 npm run test:e2e`).

Ręcznie, przed nagraniem: przejście z VoiceOver (iOS) albo TalkBack (Android). Wyniki, znane
ograniczenia i plan są na stronie „Deklaracja dostępności” (`/deklaracja-dostepnosci`).
