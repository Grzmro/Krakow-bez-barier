# Scenariusz demo

Dwa scenariusze na tych samych prawdziwych danych:

1. **[Pokaz na żywo dla jury](#pokaz-na-żywo-dla-jury)** (3:00, osoba na wózku): klik po kliku,
   z planem B dla każdej sceny. Pokazuje pętlę „Uzupełnij → konto demo moderatora → Zatwierdź → nowy
   fakt”, stan „Sprzeczne” i awarię źródła. Odpowiedzi na pytania jury są w
   [submission/jury-qa.md](submission/jury-qa.md).
2. **[Wideo do zgłoszenia](#wideo-do-zgłoszenia)** (KBB-31): nagrywane automatycznie przez
   Playwright, wystarczy dograć lektora.

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

Scenariusz wideo do zgłoszenia (KBB-31). Nagranie przejścia przez aplikację robi Playwright; na
gotowe wideo wystarczy nagrać lektora z tekstu poniżej.

> **Uwaga do czasu KBB-178:** scena 2 wpisuje „Qubus” w wyszukiwarkę na ekranie głównym, a
> wyszukiwanie po nazwie przeszukuje dziś tylko widok mapy (Qubus jest poza widokiem Rynku). Przed
> nagraniem sprawdź, czy KBB-178 jest scalone, albo czy scena 2 nie kończy się „0 miejsc”.

**Wszystko na prawdziwych danych**: miejsca z OpenStreetMap (ekstrakt Geofabrik), fakty z BIP Miasta
Krakowa i BIP Małopolska, lista toalet z krakow.pl („Kraków bez barier”), z bazy, na której działa aplikacja. Warstwa
toalet MSIP (`WT_WC_2023`) nie jest danymi otwartymi, więc jest wyłączona (KBB-133). Żadnych przykładowych miejsc ze specyfikacji API
i żadnej etykiety „PRZYKŁAD” na ekranie.

### Jak nagrać

```bash
npm run db:setup                      # migracje + seed (źródła, hotele ze sceny 2–4)
npm run ingest -- --city krakow --source osm                # miejsca z OpenStreetMap
npm run ingest -- --city krakow --source krakow-pl-toilets  # toalety z krakow.pl (strona „miasto” rozbieżności)
npm run demo:record                   # build bez mocka + dwa `next start` tego repo, nagranie
DEMO_PACE=0.2 npm run demo:record     # szybki przebieg kontrolny (krótsze pauzy)
E2E_BASE_URL=https://<deploy> DEMO_OUTAGE_BASE_URL=https://<deploy z awarią> npm run demo:record
```

- Wynik: `apps/web/demo-output/kbb-demo.webm` i `kbb-demo.mp4` (MP4 tylko, gdy jest `ffmpeg`;
  zgłoszenie wymaga MP4). 1920×1080: aplikacja w ramce telefonu (412×915), obok napis sceny,
  kółko w miejscu „dotknięcia”.
- Test kończy się błędem, gdy przejście trwa dłużej niż 3:00. W konsoli wypisuje czas każdej
  sceny — według niego układamy lektora.
- **Baza jest wymagana.** Bez `DATABASE_URL` nagranie nie startuje (błąd konfiguracji z instrukcją),
  a gdy baza nie odpowiada albo brakuje miejsca ze scenariusza, kończy się błędem na starcie —
  nigdy nie przechodzi po cichu na przykładowe dane. Build ma zawsze `NEXT_PUBLIC_API_MOCK` puste.
- Miejsca są wyszukiwane w API po nazwie (Qubus, Hotel Miodowa) albo po stanie (toaleta najbliżej Rynku,
  w której miasto i OpenStreetMap podają różną ogólną dostępność), nie po identyfikatorach. Nazwy są w
  jednym miejscu skryptu, `PLACES`.
- **Awaria źródła** to przełącznik operatora `SIMULATE_SOURCE_OUTAGE=krakow-pl-toilets` (zmienna serwera,
  KBB-29). Lokalnie nagranie uruchamia drugi `next start` tego samego buildu i tej samej bazy z tym
  przełącznikiem i tylko scena „Źródło niedostępne” oraz „O danych” idą przez niego. Dla wdrożenia
  podaj jego adres w `DEMO_OUTAGE_BASE_URL` (np. wdrożenie podglądowe z przełącznikiem, patrz
  [deployment.md](deployment.md) pkt 7); bez niego nagranie pomija tę scenę z ostrzeżeniem.
- **Awaria źródła na żywo (KBB-179)**: na produkcji bez zmiennych serwera — `/moderator` → „Wejdź na konto
  demonstracyjne” → zakładka „Demo źródeł” → wybierz źródło → „Symuluj awarię”. „O danych” i karty miejsc
  pokazują „Odświeżenie nie powiodło się — dane z …” z etykietą „Tryb demo”; wyłącza się przyciskiem „Wyłącz”
  albo sama po 15 min. Wymaga migracji `0007_source_outage_simulations` (`npm run db:migrate`).
- **Scena 5 wysyła prawdziwe zgłoszenie** („Ogólna dostępność: Dostępne dla wózków”) do bazy, na której działa aplikacja.
  Czeka na moderację i nie zmienia danych. Nagrywaj na bazie demo, nie produkcyjnej.
- **Przed każdym kolejnym nagraniem odrzuć zgłoszenia z poprzedniego** w `/moderator` (albo postaw
  bazę demo od nowa: `npm run db:setup` + ingest). Inaczej karta toalety pokaże starsze wpisy
  „Zgłoszenie użytkownika” obok nowego.
- Skrypt: `apps/web/e2e/demo/record-demo.ts` (osobna konfiguracja `playwright.demo.config.ts`, poza
  `npm run test:e2e`).

### Miejsca w scenariuszu

Stan danych z 2026-10-04 (OSM: ekstrakt Geofabrik z 2026-10-02, krakow.pl: strona z aktualizacją 2025-09-15).
Przed nagraniem nagranie samo sprawdza, że każde z nich jest w bazie.

Skąd są w bazie: Qubus i Hotel Miodowa pochodzą ze snapshotu seeda `npm run db:setup`
(`packages/db/seed/demo-places.json`), toaleta i jej fakty OSM z `ingest --source osm`, a fakty miasta
z `ingest --source krakow-pl-toilets` (wpis „Rynek Główny (Sukiennice)” przypięty do toalety OSM
`node/3533569749`, patrz `apps/ingest/src/cities/data/krakow-pl-toilets.ts`). OSM nadpisuje nazwy, stąd
toaleta ma na karcie samą nazwę z OSM.

| Scena | Miejsce | Co mówią dane |
|---|---|---|
| 2–3 · Fakty | **Qubus** (hotel, Nadwiślańska 6) | OSM: `wheelchair=yes`, 9 kondygnacji, sprawdzone 2026-02-11. Wejście, drzwi, winda, toaleta — brak danych. Werdykt dla profilu „Wózek”: „Brak danych · wejście”. |
| 4 · Niepełne dane | **Hotel Miodowa** (Miodowa 51) | OSM: tylko `wheelchair=yes`; żadnej konkretnej bariery. Na karcie „Brak danych” przy każdej cesze. |
| 4 · Rozbieżne dane | **Toaleta publiczna** (OSM `node/3533569749`, Sukiennice, Rynek Główny) | krakow.pl: na liście toalet dostosowanych, „platforma” (stan na 15.09.2025, licencja niekomercyjna, do potwierdzenia); OpenStreetMap: `wheelchair=limited`. Lista miasta jest starsza niż 12 miesięcy, więc jej fakt jest „Może być nieaktualne”, a wartość daje świeższe OSM; karta pokazuje oba źródła z datami. Gdy miasto odświeży stronę, ten sam przypadek stanie się „Sprzeczne”. Tak samo: toaleta przy pl. Szczepańskim (`node/274115129`) i przy Cmentarzu Mogilskim (`way/963795022`, OSM `no`). |
| 4 · Źródło niedostępne | ta sama toaleta, przy symulowanej awarii krakow.pl | „Odświeżenie nie powiodło się”; fakty krakow.pl oznaczone jako nieaktualne, ogólną dostępność rozstrzyga świeższe OpenStreetMap. |
| 7 · Dla firm | widget hotelu **Qubus** (`/dla-firm?miejsce=<id>`) | Ta sama karta co w aplikacji, z tymi samymi źródłami. |

### Scenariusz

Grupa docelowa: **osoba na wózku** (profil „Wózek”); ten sam przebieg działa dla profilu
„Wózek dziecięcy”. Czasy z przebiegu `npm run demo:record` (plik wideo ok. 2:35); po każdym nagraniu sprawdź je w konsoli.

| Czas | Scena | Co widać | Lektor |
|---|---|---|---|
| 0:00 | 1 · Dla kogo | Strona główna: wyszukiwarka, mapa, lista prawdziwych miejsc | Pani Anna porusza się na wózku. Zanim wyjdzie z domu, chce wiedzieć, czy w miejscu docelowym nie zatrzymają jej schody albo za wąskie drzwi. Nie zakłada konta. |
| 0:06 | 1 · Dla kogo | Wybór profilu „Wózek”, okno „Progi profilu” | Wybiera profil „Wózek”. Profil to tylko progi: ile stopni, jaka szerokość drzwi, czy potrzebna toaleta. Nie pytamy o niepełnosprawność. |
| 0:17 | 2 · Miejsce | Wpisanie „Qubus”, wynik na liście i na mapie | Szuka hotelu Qubus. To prawdziwe miejsca z OpenStreetMap — wynik jest na liście i na mapie, a lista to pełna, tekstowa wersja mapy. |
| 0:22 | 2 · Miejsce | „Brak danych · wejście”, rozwinięte „Dlaczego?”: wejście, drzwi, winda, toaleta — nie wiadomo | Werdykt jest słowem, nie kolorem. OpenStreetMap mówi tylko „dostępny dla wózków” — o stopniach i drzwiach nie mówi nic, więc aplikacja nie udaje, że wie. |
| 0:32 | 3 · Konkretne fakty | Karta miejsca: stopnie, drzwi, winda, toaleta, kondygnacje | Na karcie nie ma etykiety „dostępne”. Są konkretne cechy, a tam, gdzie nikt ich nie sprawdził, „Brak danych”. |
| 0:39 | 3 · Skąd wiemy? | Rozwinięte „Kondygnacje”: źródło OpenStreetMap, data, „Niezweryfikowane” | Przy każdej informacji jest źródło, data i wiarygodność. Jedno źródło społeczności to „niezweryfikowane”, a nie gwarancja. |
| 0:47 | 4 · Niepełne dane | Hotel Miodowa: „Brak danych” przy każdej cesze | Hotel Miodowa: w danych jest tylko ogólne „tak”. Mówimy „brak danych” — szarym kolorem, nigdy jako „dostępne”. Można zapytać obiekt albo uzupełnić dane. |
| 0:55 | 4 · Rozbieżne dane | „Toaleta publiczna” w Sukiennicach: „Ogólna dostępność: Częściowo dostępne dla wózków”, rozwinięte: krakow.pl „Może być nieaktualne · 15.09.2025” z cytatem, OpenStreetMap | Miasto wpisuje tę toaletę na listę dostosowanych, z platformą; OpenStreetMap mówi „częściowo”. Lista miasta ma ponad rok, więc pokazujemy ją jako możliwie nieaktualną — ale obok, ze źródłem i datą, nie ukrywamy jej. |
| 1:08 | 5 · Zgłoszenie | „To się nie zgadza” → „Dostępne dla wózków” → „Wyślij” | Pani Anna była na miejscu, więc poprawia dane: trzy kroki, bez konta i bez e-maila. |
| 1:16 | 5 · Zgłoszenie | „Twoje zgłoszenie: Dostępne dla wózków · Niezweryfikowane” | Zgłoszenie czeka na moderację. Do tego czasu nie zmienia danych — jest widoczne obok jako niezweryfikowane. |
| 1:24 | 4 · Źródło niedostępne | Ta sama toaleta przy awarii krakow.pl: „Odświeżenie nie powiodło się” | Symulujemy awarię miejskiego serwisu krakow.pl. Nie ukrywamy jej: dane miasta zostają, z datą i jako nieaktualne. |
| 1:32 | 6 · Źródła danych | „O danych”: krakow.pl „Niedostępne” (symulowana awaria), OSM i BIP działają, MSIP „Wyłączone” z powodem, zasady wiarygodności | Dane pochodzą z OpenStreetMap, BIP Miasta Krakowa, BIP Małopolska i krakow.pl. Dla każdego: licencja, częstotliwość odświeżania i stan — także awaria. Warstwę miejską bez jasnej licencji wyłączamy i mówimy dlaczego. Miasto nie utrzymuje żadnej bazy. |
| 1:43 | 7 · Dla firm | Widget z kartą hotelu Qubus na stronie obiektu, kod do wklejenia, API | Hotel osadza na swojej stronie aktualną kartę dostępności jednym kodem. Systemy rezerwacyjne i aplikacje turystyczne biorą te same dane z API. |
| 1:50 | 7 · Model biznesowy | Cennik: karta na stronie, weryfikacja na miejscu | Płacą obiekty — za kartę na stronie i weryfikację na miejscu. Mieszkańcy i turyści korzystają za darmo. |
| 1:57 | 8 · Dostępność | Przejścia klawiszem Tab: „Przejdź do treści”, widoczny fokus, menu | Aplikacja sama jest dostępna: cały scenariusz przejdziemy klawiaturą, statusy są tekstem, nie tylko kolorem, a mapa ma tekstowy odpowiednik. |
| 2:05 | 8 · Dostępność | „Deklaracja dostępności”: co działa, ograniczenia, plan | Celem jest WCAG 2.2 AA. Każdy ekran sprawdzamy automatycznie, a w deklaracji uczciwie piszemy, czego jeszcze nie ma — na przykład testów z czytnikami ekranu — i kiedy to zrobimy. |
| 2:17 | 9 · Od prototypu do usługi | Strona główna | Usługę prowadzi niezależny operator — nie Urząd Miasta, który nie utrzymuje żadnej bazy. Hosting, moderację zgłoszeń i utrzymanie opłacają obiekty: za kartę na swojej stronie i weryfikację na miejscu; mieszkańcy i turyści korzystają za darmo. |
| 2:24 | 9 · Od prototypu do usługi | Strona główna | Plan: pilotaż w Krakowie z testami z użytkownikami, potem panel właściciela obiektu. Kolejne miasto to konfiguracja — obszar OpenStreetMap i lista otwartych źródeł — oraz lokalny moderator; bez nowego kodu. |
| 2:31 | Zakończenie | Strona główna | Kraków bez barier: konkretne fakty, źródło przy każdej informacji, otwarte dane. Dziękujemy. |

### Pokrycie oceny jury (wideo)

Punkty z [challenge.md](challenge.md) → „How the jury will evaluate it”.

| Punkt jury | Sceny |
|---|---|
| Grupa docelowa i jej potrzeby | 1 (osoba na wózku, profil jako progi, bez pytań o niepełnosprawność) |
| Sprawdzenie miejsca, konkretne bariery i udogodnienia | 2, 3 |
| Pochodzenie danych: źródło, data, wiarygodność | 3, 6 |
| Oznaczenie danych niepełnych, nieaktualnych, niezweryfikowanych | 2–3 (niezweryfikowane, brak danych), 4 (brak danych, nieaktualne) |
| Przypadek awarii: sprzeczne, niepełne, niedostępne źródło; brak informacji ≠ dostępność | 4 (niepełne, rozbieżne/nieaktualne i niedostępne źródło, na prawdziwych miejscach; stan „Sprzeczne” dla dwóch świeżych źródeł pokazuje `/o-danych` i e2e na danych przykładowych) |
| Poprawianie błędnych danych | 5 |
| Kontrola dostępności: klawiatura, czytnik ekranu, kontrast, mapa jako tekst; ograniczenia i plan | 2 (lista = mapa), 8 |
| Prototyp → usługa: właściciel, dane, hosting, plan, kolejne miasto | 6 (dane), 7 (kto płaci), 9 (operator, finansowanie hostingu, plan, warunki dla kolejnego miasta) |

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
