# Wykaz funkcji: co działa, a co wymaga dalszych prac

Materiał do oceny („Wykaz funkcji już dostępnych i elementów wymagających dalszych prac”,
[requirements.md](../requirements.md)). Stan gałęzi `main` na **3.10.2026**. Każdy wiersz
„Gotowe” ma scalony PR w repozytorium; numery US-x.y odnoszą się do
[requirements.md](../requirements.md), R1–R8 do [challenge.md](../challenge.md).

## Jak uruchomić prototyp

- Domyślnie aplikacja webowa działa na **danych przykładowych z kontraktu API** (`NEXT_PUBLIC_API_MOCK=true`,
  stały baner „PRZYKŁAD”). Z `NEXT_PUBLIC_API_MOCK=false` i bazą PostGIS (`DATABASE_URL`) korzysta z
  prawdziwego API i danych z [demo-data.md](../demo-data.md).
- Cron ingest jest w `main` (`.github/workflows/ingest.yml`, codziennie 03:17 UTC) i działa po
  ustawieniu sekretu `DATABASE_URL`. Publiczne wdrożenie Vercel + Postgres/PostGIS jest w PR #44
  (KBB-21) — **w toku**.
  Link do demo: **[link do demo — do uzupełnienia]**.

## Gotowe (scalone do `main`)

### Dla każdego, bez konta (E1, R1, R4)

| Funkcja | US | PR |
|---|---|---|
| Start bez konta, profilu i pytań o niepełnosprawność | US-1.1 | #20 |
| Wyszukiwanie po nazwie z podpowiedziami, kategorie, wyniki na mapie i na liście | US-1.2 | #20, #36 |
| Szybkie filtry cech (bez schodów, winda, toaleta dostosowana, ławki, parking, przewijak) i „Pokaż też miejsca bez danych” | US-1.3 | #20, #36 |
| Karta miejsca: wejście, winda, nawierzchnia, toaleta, odpoczynek, parking — wartości z jednostką, bez zbiorczej oceny | US-1.4 | #16 |
| Podsumowanie faktów na liście; „Brak danych” nazwany wprost | US-1.5 | #20, #36 |
| Kontakt do obiektu (telefon, strona, e-mail), gdy jest w danych | US-1.6 | #16, #36 |
| Stały link do karty miejsca (udostępnianie) | US-1.7 | #16 |

### Profile potrzeb „Wózek” i „Wózek dziecięcy” (E2, R4)

| Funkcja | US | PR |
|---|---|---|
| Włączenie profilu jednym kliknięciem; profil i progi tylko w przeglądarce (localStorage) | US-2.1, US-2.2 | #18, #35 |
| Zmiana progów i przywrócenie domyślnych | US-2.3 | #18 |
| Werdykty „Spełnia” / „Nie spełnia” / „Brak danych” / „Sprzeczne” na liście, mapie i karcie; „Ukryj niespełniające” | US-2.4, US-6.1 | #35, #36, #40 |
| Grupy „Blokuje”, „Pasuje”, „Nie wiadomo” na karcie | US-2.5 | #18 |
| Przełączanie i wyłączanie profilu bez przeładowania | US-2.6, US-2.7 | #35 |
| Jedna implementacja werdyktu (Resolver + Matcher) z testami jednostkowymi | US-3.3, US-3.4 | #21, #36 |

### Wiarygodność danych (E3, R2)

| Funkcja | US | PR |
|---|---|---|
| Przy każdej cesze: źródło, data pozyskania/potwierdzenia, status; „Skąd wiemy?” rozwijane klawiaturą | US-3.1 | #16 |
| „Niezweryfikowane” jako tekst; werdykt z takich danych z dopiskiem „niepotwierdzone” | US-3.2 | #16, #35 |
| Dane sprzeczne: obie wartości ze źródłem i datą, nigdy „Spełnia” | US-3.3 | #21, #36 |
| Brak danych nigdy jako dostępność (test automatyczny) | US-3.4 | #21, #36 |
| „Może być nieaktualne” po 12 miesiącach | US-3.5 | #21 |
| Status źródeł (`GET /sources`): ostatnia udana aktualizacja, awaria, przełącznik demo `SIMULATE_SOURCE_OUTAGE` | US-3.6, US-5.4, US-5.7 | #37 |
| Baner „PRZYKŁAD” i znacznik na danych przykładowych | US-3.7 | #9, #31 |
| Strona „O danych” z listą źródeł, licencjami, atrybucją © OpenStreetMap contributors | US-3.8 | #17, #37 |

### Zgłoszenia, potwierdzenia, moderacja (E4)

| Funkcja | US | PR |
|---|---|---|
| „To się nie zgadza”, „Uzupełnij”, „Potwierdzam” przy cesze; bez konta; „Cofnij” przez 5 s | US-4.1, US-4.2, US-4.3 | #26, #38 |
| Walidacja zakresów (np. szerokość), limity na klienta, pułapka na boty (honeypot) | US-4.5 | #38 |
| Dwa niezależne potwierdzenia → „Potwierdzone przez społeczność” | US-4.2 | #38 |
| Panel moderatora `/moderator`: kolejka, podgląd zmiany, zatwierdź / odrzuć / do wyjaśnienia, historia (kto, co, kiedy) | US-4.4 | #38, #42 |

### Dane i architektura (E5, R3, R5)

| Funkcja | US | PR |
|---|---|---|
| Ingest jako osobna aplikacja (`apps/ingest`): adapter na źródło, fakty z pochodzeniem, dziennik uruchomień, ponawianie, ostatnia dobra kopia | US-5.3, US-5.4, US-5.6 | #30, #37 |
| Adapter OpenStreetMap (Overpass) z mapowaniem tagów; `wheelchair=limited` zostaje „ograniczone” | US-5.1 | #30 |
| Adaptery miejskie: toalety MSIP, parking OZN (ZDMK), przystanki ZTP — przetestowane, **nie ładują danych do potwierdzenia licencji** (`licenseConfirmed: false`) | US-5.2 | #41 |
| Rejestr źródeł z licencjami i zachowaniem przy awarii | US-5.2 | #28 |
| Trzy przypadki demo na prawdziwych danych (sprzeczne, niepełne, źródło niedostępne) | US-5.7 | #14 |
| Miasto i kategoria jako konfiguracja (Wrocław jako przykład drugiego miasta na samym OSM) | US-10.1, US-10.2 | #39 |
| Opis zależności, licencji i przeniesienia na inną infrastrukturę | US-10.3 | #28 |

### Mapa i dostępność cyfrowa (E6, E8, R6)

| Funkcja | US | PR |
|---|---|---|
| Lista równoważna mapie, statusy rozróżnialne bez koloru | US-6.1, US-6.2 | #20, #35 |
| Mapa bez gestów (przyciski, klawiatura), atrybucja OSM na mapie | US-6.3, US-6.5 | #20 |
| „W mojej okolicy”: pozycja ustalana na urządzeniu, nie trafia na serwer | US-6.6 (część) | #23 |
| Klawiatura, widoczny fokus, „Przejdź do treści”, ogłaszanie zmian | US-8.1, US-8.2 | #9, #20 |
| Audyt axe (WCAG 2.2 A/AA) i snapshot ARIA w każdym teście e2e ekranu | US-8.1–8.3 | #10 |
| Deklaracja dostępności i strona „Prywatność” | US-8.5, US-8.2 (prywatność) | #17 |

### Wdrożenie u partnerów i kanały (E9, R8)

| Funkcja | US | PR |
|---|---|---|
| Widget `/widget/{placeId}` do osadzenia przez `<iframe>`, strona „Dla firm” z kodem do wklejenia | US-9.1 | #25, #43 |
| Publiczne API tylko do odczytu (OpenAPI 3.1), CORS, nagłówki licencji danych, limity zapytań, dokumentacja `/api/docs` | US-9.2 | #29, #36, #43 |
| PWA: instalacja, tryb offline z ostatnimi danymi i datą | — | #22 |
| Aplikacja iOS/Android (Capacitor) z tego samego kodu, natywna geolokalizacja | — | #23, #33, #34 |

## W toku (otwarte zadania i PR)

| Element | Zadanie |
|---|---|
| Publiczne wdrożenie: Vercel + Postgres/PostGIS (cron ingest jest już w `main`) | KBB-21 (PR #44) |
| „W mojej okolicy” na ekranie głównym: sortowanie i mapa wg pozycji | KBB-54 (US-6.6, PR #47) |
| Strona „Dojazd i wejście bez barier” dla organizatora wydarzenia | KBB-55 (US-9.4, PR #49) |
| Nowy profil (np. senior) z samej konfiguracji | KBB-48 (US-2.8, PR #46) |
| Scenariusz demo, automatyczne nagranie i kontrola dostępności | KBB-50 (PR #45) |
| Dostępne trasy: openrouteservice, bariery wzdłuż trasy, ekran trasy | KBB-22 (E7) |

## Zaplanowane (jeszcze nie zaczęte)

| Element | Zadanie |
|---|---|
| Wersja angielska | KBB-57 (US-8.6) |
| Film demo (max 3 min, napisy PL) | KBB-31 |

## Wymaga dalszych prac

| Element | Dlaczego | Zadanie |
|---|---|---|
| Front domyślnie na prawdziwym API, usunięcie warstwy mocków | dziś domyślnie dane przykładowe z kontraktu | KBB-46 |
| Oczekujące zgłoszenia z API widoczne na karcie jako „Niezweryfikowane” | dziś tylko lokalnie po wysłaniu | KBB-49 |
| Winda blokuje tylko w miejscach z piętrami | brak danych o kondygnacjach; dziś brak windy = „Nie wiadomo” | KBB-47 |
| Ładowanie źródeł miejskich | licencje MSIP / ZDMK / ZTP do potwierdzenia z miastem; kategorie parking/przystanek | KBB-52, KBB-53 |
| Panel właściciela obiektu (US-9.3), zdjęcia w zgłoszeniach (US-4.6), wycofanie zgłoszenia linkiem (US-8.4), link do edycji w OSM (US-4.7) | wartość dodana, nie zaczęte | — |
| Retencja zgłoszeń 24 mies. (deklarowana na stronie „Prywatność”) | brak automatycznego usuwania w kodzie | — |
| Testy z użytkownikami czytników ekranu, zewnętrzny audyt WCAG 2.2 AA, audyt licencji zależności | wymaga ludzi i czasu poza hackathonem | — |
