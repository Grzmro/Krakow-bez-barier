# Scenariusz demo (wideo ≤ 3:00)

Scenariusz wideo do zgłoszenia (KBB-31) i pokazu na żywo. Nagranie przejścia przez aplikację robi
Playwright; na gotowe wideo wystarczy nagrać lektora z tekstu poniżej.

## Jak nagrać

```bash
npm run demo:record                                   # build + next start tego repo
E2E_BASE_URL=https://<deploy> npm run demo:record     # to samo na wdrożonej aplikacji (KBB-21)
DEMO_PACE=0.2 E2E_BASE_URL=http://localhost:3000 npm run demo:record   # szybki przebieg kontrolny
```

- Wynik: `apps/web/demo-output/kbb-demo.webm` i `kbb-demo.mp4` (MP4 tylko, gdy jest `ffmpeg`;
  zgłoszenie wymaga MP4). 1920×1080: aplikacja w ramce telefonu (412×915), obok napis sceny,
  kółko w miejscu „dotknięcia”.
- Test kończy się błędem, gdy przejście trwa dłużej niż 3:00. W konsoli wypisuje czas każdej
  sceny — według niego układamy lektora.
- Nagranie używa identyfikatorów przykładowych miejsc z mock API, więc lokalny build zawsze
  działa w trybie mock (`NEXT_PUBLIC_API_MOCK=true`, niezależnie od `.env`). Przebieg
  z `E2E_BASE_URL` wymaga wdrożenia w trybie mock — do czasu TODO(KBB-28).
- Skrypt: `apps/web/e2e/demo/record-demo.ts` (osobna konfiguracja `playwright.demo.config.ts`, poza
  `npm run test:e2e`).
- Dane: przykładowe miejsca z mock API, oznaczone „PRZYKŁAD” (TODO(KBB-28): podmienić na miejsca
  z [demo-data.md](demo-data.md), gdy API je zwróci — identyfikatory są w jednym miejscu skryptu,
  `PLACES`).

## Scenariusz

Grupa docelowa: **osoba na wózku** (profil „Wózek”); ten sam przebieg działa dla profilu
„Wózek dziecięcy”. Czasy z przebiegu `npm run demo:record` (plik wideo ok. 2:50); po każdym nagraniu sprawdź je w konsoli.

| Czas | Scena | Co widać | Lektor |
|---|---|---|---|
| 0:00 | 1 · Dla kogo | Strona główna: wyszukiwarka, mapa, lista, pasek „PRZYKŁAD” | Pani Anna porusza się na wózku. Zanim wyjdzie z domu, chce wiedzieć, czy w miejscu docelowym nie zatrzymają jej schody albo za wąskie drzwi. Nie zakłada konta. |
| 0:07 | 1 · Dla kogo | Wybór profilu „Wózek”, okno „Progi profilu” | Wybiera profil „Wózek”. Profil to tylko progi: ile stopni, jaka szerokość drzwi, czy potrzebna toaleta. Nie pytamy o niepełnosprawność. |
| 0:18 | 2 · Miejsce | Wpisanie „Hotel”, wynik na liście i na mapie | Szuka hotelu. Wynik jest na liście i na mapie — lista to pełna, tekstowa wersja mapy. |
| 0:27 | 2 · Miejsce | „Spełnia · niepotwierdzone”, rozwinięte „Dlaczego?” | Hotel spełnia jej progi, ale część danych jest niepotwierdzona — i aplikacja mówi to wprost, a „Dlaczego?” pokazuje, które cechy pasują. |
| 0:37 | 3 · Konkretne fakty | Karta miejsca: stopnie, próg, drzwi, winda, toaleta | Na karcie nie ma etykiety „dostępne”. Są konkretne fakty: zero stopni, próg 1 cm, drzwi 90 cm, winda, toaleta. |
| 0:45 | 3 · Skąd wiemy? | Rozwinięta szerokość drzwi: źródło, data, „Potwierdzone” | Przy każdej informacji jest źródło, data i wiarygodność. Te dane są przykładowe i tak je oznaczamy. |
| 0:53 | 3 · Skąd wiemy? | Winda z OpenStreetMap, „Niezweryfikowane” | Winda pochodzi z OpenStreetMap — jedno źródło społeczności, więc „niezweryfikowane”, a nie gwarancja. |
| 1:00 | 4 · Niepełne dane | Kawiarnia: „Brak danych” przy każdej cesze | Gdy nie wiemy, mówimy „brak danych” — szarym kolorem, nigdy jako „dostępne”. Można zapytać obiekt albo uzupełnić dane. |
| 1:09 | 4 · Źródło niedostępne | Pałac Krzysztofory: „Odświeżenie nie powiodło się — dane z 8.11.2023” | Miejski serwer MSIP nie odpowiada. Nie ukrywamy tego: pokazujemy ostatnie znane dane z datą i jako nieaktualne. |
| 1:17 | 4 · Sprzeczne dane | Toaleta: „Jest / Nie ma”, oba źródła z datami | Miasto i OpenStreetMap mówią co innego o toalecie. Pokazujemy obie wersje ze źródłami — decyzję zostawiamy użytkownikowi. |
| 1:27 | 5 · Zgłoszenie | „To się nie zgadza” → wartość → „Wyślij” | Pani Anna była na miejscu, więc poprawia dane: trzy kroki, bez konta i bez e-maila. |
| 1:35 | 5 · Zgłoszenie | Zgłoszenie „Niezweryfikowane”, fakt dalej „Sprzeczne” | Zgłoszenie czeka na moderację. Do tego czasu nie zmienia danych — jest widoczne obok jako niezweryfikowane. |
| 1:42 | 6 · Źródła danych | „O danych”: OSM działa, MSIP niedostępne, zasady wiarygodności | Dane pochodzą z otwartych źródeł: OpenStreetMap i MSIP Krakowa. Dla każdego: licencja, częstotliwość odświeżania i stan — także awaria. Miasto nie utrzymuje żadnej bazy. |
| 1:54 | 7 · Dla firm | Widget na stronie hotelu, kod do wklejenia, API | Hotel osadza na swojej stronie aktualną kartę dostępności jednym kodem. Systemy rezerwacyjne i aplikacje turystyczne biorą te same dane z API. |
| 2:01 | 7 · Model biznesowy | Cennik: karta na stronie, weryfikacja na miejscu | Płacą obiekty — za kartę na stronie i weryfikację na miejscu. Mieszkańcy i turyści korzystają za darmo. |
| 2:08 | 8 · Dostępność | Przejścia klawiszem Tab: „Przejdź do treści”, widoczny fokus, menu | Aplikacja sama jest dostępna: cały scenariusz przejdziemy klawiaturą, statusy są tekstem, nie tylko kolorem, a mapa ma tekstowy odpowiednik. |
| 2:15 | 8 · Dostępność | „Deklaracja dostępności”: co działa, ograniczenia, plan | Celem jest WCAG 2.2 AA. Każdy ekran sprawdzamy automatycznie, a w deklaracji uczciwie piszemy, czego jeszcze nie ma — na przykład testów z czytnikami ekranu — i kiedy to zrobimy. |
| 2:27 | 9 · Od prototypu do usługi | Strona główna | Usługę prowadzi niezależny operator — nie Urząd Miasta, który nie utrzymuje żadnej bazy. Hosting, moderację zgłoszeń i utrzymanie opłacają obiekty: za kartę na swojej stronie i weryfikację na miejscu; mieszkańcy i turyści korzystają za darmo. |
| 2:34 | 9 · Od prototypu do usługi | Strona główna | Plan: pilotaż w Krakowie z testami z użytkownikami, potem panel właściciela obiektu. Kolejne miasto to konfiguracja — obszar OpenStreetMap i lista otwartych źródeł — oraz lokalny moderator; bez nowego kodu. |
| 2:41 | Zakończenie | Strona główna | Kraków bez barier: konkretne fakty, źródło przy każdej informacji, otwarte dane. Dziękujemy. |

## Pokrycie oceny jury

Punkty z [challenge.md](challenge.md) → „How the jury will evaluate it”.

| Punkt jury | Sceny |
|---|---|
| Grupa docelowa i jej potrzeby | 1 (osoba na wózku, profil jako progi, bez pytań o niepełnosprawność) |
| Sprawdzenie miejsca, konkretne bariery i udogodnienia | 2, 3 |
| Pochodzenie danych: źródło, data, wiarygodność | 3, 6 |
| Oznaczenie danych niepełnych, nieaktualnych, niezweryfikowanych; dane przykładowe jako przykład | 3 (niezweryfikowane, „Przykład”), 4 (brak danych, nieaktualne) |
| Przypadek awarii: sprzeczne, niepełne, niedostępne źródło; brak informacji ≠ dostępność | 4 (wszystkie trzy) |
| Poprawianie błędnych danych | 5 |
| Kontrola dostępności: klawiatura, czytnik ekranu, kontrast, mapa jako tekst; ograniczenia i plan | 2 (lista = mapa), 8 |
| Prototyp → usługa: właściciel, dane, hosting, plan, kolejne miasto | 6 (dane), 7 (kto płaci), 9 (operator, finansowanie hostingu, plan, warunki dla kolejnego miasta) |

## Kontrola dostępności głównego scenariusza

Automatycznie, w `npm run test:e2e` — `apps/web/e2e/main-scenario-a11y.spec.ts`:

- cały scenariusz samą klawiaturą (wyszukanie → profil → „Progi profilu” i Escape → karta → fakt →
  formularz zgłoszenia, Escape → zgłoszenie wysłane przyciskiem „Wyślij”), axe WCAG 2.2 A/AA na
  każdym kroku; fokus wraca do przycisku, który otworzył okno, po każdym jego zamknięciu;
- każda pinezka mapy ma wiersz na liście z tym samym statusem (mapa jako tekst);
- ekrany ze scenariusza przy powiększeniu 200% (640×400) i szerokości 320 px: bez przewijania
  w poziomie, axe bez błędów (w tym kontrast).

Ręcznie, przed nagraniem: przejście z VoiceOver (iOS) albo TalkBack (Android). Wyniki, znane
ograniczenia i plan są na stronie „Deklaracja dostępności” (`/deklaracja-dostepnosci`).
