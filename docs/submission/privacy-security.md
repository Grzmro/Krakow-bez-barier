# Ochrona danych i bezpieczeństwo

Materiał do oceny (R7: „jakie dane o użytkowniku zbieramy, jak chronimy zgłoszenia i konta,
tylko bezpieczne połączenia”). Stan `main` na **3.10.2026**. Przy każdym punkcie podajemy, gdzie
jest w kodzie; to, czego kod jeszcze nie wymusza, jest oznaczone **„deklaracja, nie w kodzie”**.

## Zasada: nie pytamy o zdrowie i nie mamy kont użytkowników

- Żaden ekran nie pyta o niepełnosprawność, diagnozę, wiek ani tożsamość (US-1.1, R4). Dopasowanie
  wyników opiera się tylko na progach barier i udogodnień (np. „szerokość wejścia min. 90 cm”).
- **Profil potrzeb i progi zostają w przeglądarce** (`localStorage`); serwer dostaje nazwę profilu
  (np. `profile=wheelchair`) i progi jako parametry zapytania `GET /places`, bez identyfikatora
  użytkownika; aplikacja ich nie zapisuje (`profileQuery`, `apps/web/src/lib/profile/thresholds.ts`;
  decyzja w [architecture.md](../architecture.md)). Logi dostępowe hostingu (adres URL żądania) są
  poza kodem aplikacji.
- **Lokalizacja zostaje na urządzeniu**: „W mojej okolicy” ustala pozycję przez przeglądarkę albo
  natywnie w aplikacji (za zgodą systemu) i nie wysyła jej na serwer
  (`apps/web/src/lib/native/geolocation.ts`, `components/layout/near-me.tsx`).
- Brak kont dla mieszkańców i turystów. Jedyne logowanie to panel moderatora (niżej).
- Brak reklam, analityki śledzącej i pikseli zewnętrznych — w kodzie nie ma żadnego skryptu
  analitycznego.

## Jakie dane powstają

| Dane | Skąd | Gdzie | Kto widzi |
|---|---|---|---|
| Zgłoszenie (cecha, wartość, opcjonalny komentarz, data) | formularz „To się nie zgadza” / „Uzupełnij” | tabela `reports` w Postgres | moderator; po zatwierdzeniu wartość widzą wszyscy |
| Potwierdzenie (fakt, opcjonalny komentarz, data) | „Nadal aktualne” | tabela `confirmations`; liczą się potwierdzenia z ostatnich 90 dni (dwa podnoszą fakt do „Potwierdzone”) | wszyscy (data i licznik) |
| Decyzja moderatora (nazwa moderatora, decyzja, data) | panel `/moderator` | tabela `moderation_log` | moderatorzy |
| Profil i progi | użytkownik | tylko przeglądarka | nikt poza użytkownikiem |
| Adres IP | połączenie | **tylko w pamięci procesu** na czas okna limitu, nie jest zapisywany ani logowany (`server/http/rate-limit.ts`) | nikt |

- **Dane kontaktowe są usuwane z komentarzy** przed zapisem: adresy e-mail i numery telefonów
  (9+ cyfr) zamieniamy na „[usunięto]” (`redactContactData`, `server/reports/service.ts`).
- Zgłoszenie nie przyjmuje zdjęć (`photoUrl` musi być puste) — nie ma więc metadanych lokalizacji
  ze zdjęć do usuwania.
- Retencja: strona „Prywatność” deklaruje przechowywanie zgłoszeń 24 miesiące — **deklaracja, nie
  w kodzie** (brak automatycznego usuwania; do zrobienia przed pilotażem).

## Ochrona zgłoszeń przed nadużyciem (US-4.5)

Bez zagadek CAPTCHA, zgodnie z WCAG 3.3.8 (dostępne uwierzytelnianie):

| Ochrona | Wartość | Kod |
|---|---|---|
| Limit zgłoszeń na klienta | 10 na 10 minut | `app/api/v1/reports/route.ts` |
| Limit potwierdzeń na klienta | 30 na 10 minut | `app/api/v1/places/[id]/confirmations/route.ts` |
| Niezależność potwierdzeń | 1 potwierdzenie faktu z jednego klienta na dobę | jw. |
| Pułapka na boty | ukryte pole `website` musi być puste | `server/reports/service.ts` |
| Walidacja wartości | zakresy z kontraktu (`ReportCreate.x-value-ranges`, np. szerokość w cm), tekst 1–100 znaków; błąd 422 | `checkReportValue` |
| Walidacja każdego żądania | schemat OpenAPI 3.1 (Ajv) | `server/http/route.ts` |
| Klucz klienta | za proxy hostingu (Vercel) — adres widziany przez proxy; bez proxy nagłówki `x-forwarded-for` / `x-real-ip` mogą pochodzić od klienta, więc wdrożenie musi stać za zaufanym proxy | `clientKey` w `server/http/rate-limit.ts` |

- **Zgłoszenie nigdy nie nadpisuje danych źródła.** Przed moderacją nie zmienia wartości ani werdyktu
  (zgłaszający widzi je obok faktu jako „Niezweryfikowane”; dla innych użytkowników — KBB-49); po zatwierdzeniu staje się osobnym faktem ze źródła „Społeczność, zweryfikowane
  przez moderatora”, więc różnica z innym aktualnym źródłem jest widoczna jako „Sprzeczne”. Wyjątek:
  fakt nieaktualny (starszy niż 12 miesięcy) nie bierze udziału w werdykcie, gdy istnieje fakt
  aktualny — wtedy wygrywa świeży fakt, bez oznaczenia „Sprzeczne” (`resolveAttribute`,
  `domain/resolver.ts`).
- Odrzucone zgłoszenie nie trafia do widoku publicznego.
- Ograniczenie: limity są w pamięci jednej instancji serwera (zatrzymują serię, nie są globalnym
  limitem). Przy wielu instancjach — wspólny magazyn limitów (np. Redis) — do zrobienia.

## Panel moderatora

- Dostęp tokenem z `MODERATOR_TOKENS` (zmienna środowiskowa, para `nazwa:token`, token min. 16
  znaków; krótszy jest ignorowany). Tokeny porównujemy jako skróty SHA-256 w stałym czasie
  (`server/reports/moderator-auth.ts`).
- **5 nieudanych prób blokuje klienta na 15 minut** (HTTP 429), blokada sprawdzana przed tokenem.
- Token wpisuje się w pole hasła (działa wklejanie i menedżer haseł, bez zagadek — WCAG 3.3.8);
  panel trzyma go tylko w `sessionStorage` tej karty i wysyła jako nagłówek `Authorization: Bearer`.
- Historia decyzji zapisuje nazwę moderatora, decyzję i datę (kto, co, kiedy — US-4.4).
- Konto demonstracyjne dla jury: osobny token `MODERATOR_DEMO_TOKEN` (ta sama blokada po 5 próbach), w
  panelu oznaczone „Konto demonstracyjne”. Jego zatwierdzenia trafiają do osobnego źródła „Konto
  demonstracyjne moderatora (zmiana tymczasowa)”, a po 30 minutach wszystkie jego decyzje i fakty są
  cofane — dane miejsc nie zmieniają się na stałe. Jury wchodzi przyciskiem „Wejdź na konto demonstracyjne
  (dla jury)” na `/moderator`: serwer wydaje 12-godzinną sesję podpisaną kluczem z `MODERATOR_DEMO_TOKEN`
  (HMAC), która loguje wyłącznie jako konto demo — ani ten token, ani tokeny moderatorów nie trafiają do
  przeglądarki; zmiana `MODERATOR_DEMO_TOKEN` unieważnia wszystkie sesje, a pusty wyłącza przycisk. Konto demo
  jest więc publiczne. Wprost: widzi całą prawdziwą kolejkę moderacji, z komentarzami i zdjęciami innych mieszkańców (dane kontaktowe
  są ukryte), a przez te 30 minut jego decyzje działają też wobec prawdziwych osób — odrzucenie ukrywa zgłoszenie
  na karcie miejsca, a zatwierdzenie zamyka je dla prawdziwych moderatorów (HTTP 409), dopóki decyzja nie
  zostanie cofnięta.
- Do zrobienia przy usłudze: indywidualne konta z 2FA albo logowanie SSO operatora, rotacja tokenów.

## Bezpieczne połączenia i konfiguracja

- **HTTPS**: aplikację publikujemy wyłącznie przez HTTPS na hostingu (Vercel wymusza HTTPS; PR #44).
  Aplikacja mobilna pozwala na HTTP tylko w sieci lokalnej do developmentu (iOS ATS
  `NSAllowsLocalNetworking`, Android cleartext tylko localhost/IP prywatne); produkcja to HTTPS.
  Nagłówek HSTS ustawia hosting — **w kodzie aplikacji brak własnego HSTS** (do dodania przy
  innym hostingu).
- Publiczne API tylko do odczytu ma CORS `*` wyłącznie dla ścieżek z listy (`next.config.ts`);
  zgłoszenia i moderacja nie są na tej liście, więc nowy endpoint zapisu jest domyślnie zamknięty.
- Sekrety (`DATABASE_URL`, `MODERATOR_TOKENS`, `ORS_API_KEY`) tylko w zmiennych środowiskowych i
  sekretach GitHub; w repozytorium są tylko `.env.example` z pustymi wartościami.
- Przełącznik demo awarii źródła (`SIMULATE_SOURCE_OUTAGE`) to zmienna serwera, nie parametr
  żądania; w produkcji działa tylko z `ALLOW_SIMULATED_OUTAGE=true`.
- Logi serwera: tylko błędy API (nazwa operacji i błąd), bez adresów IP. **Ograniczenie:** przy
  awarii bazy błąd zapytania (`DrizzleQueryError`) zawiera parametry zapytania, więc nieudany zapis
  zgłoszenia lub potwierdzenia może trafić do logu z wartością i komentarzem
  (`server/http/route.ts`) — do poprawy przed pilotażem.

## Plan przed usługą

1. Automatyczne usuwanie zgłoszeń po 24 miesiącach (zostaje zatwierdzona wartość i data).
2. Konta moderatorów z 2FA, rotacja tokenów, dziennik logowań.
3. Wspólny magazyn limitów dla wielu instancji.
4. HSTS i polityka CSP dla całej aplikacji, test penetracyjny raz w roku.
5. Rejestr czynności przetwarzania (RODO) i umowa powierzenia z hostingiem w UE.
6. Logi błędów bez parametrów zapytań do bazy (tylko nazwa i kod błędu).
