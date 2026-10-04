# Plan uruchomienia i utrzymania poza infrastrukturą UMK

Materiał do oceny (Required deliverable 9: „kto odpowiada za hosting, aktualizacje,
bezpieczeństwo, obsługę zgłoszeń i koszty”) oraz plan przejścia od prototypu do usługi. Stan
`main` na **3.10.2026**. Liczby oznaczone **(szacunek)** to nasze wyliczenia, nie oferty ani wyniki.
Szczegóły techniczne: [deployment.md](../deployment.md), źródła: [data-sources.md](../data-sources.md).

## Podsumowanie

**Miasto daje otwarte dane, nie serwery.** Usługę prowadzi niezależny operator na własnej
infrastrukturze; Miasto nie hostuje, nie utrzymuje bazy i nie daje dostępu do systemów UMK/MJO.

| Obszar | Kto odpowiada | Jak |
|---|---|---|
| Właściciel produktu | operator: spółka z o.o. non-profit / przedsiębiorstwo społeczne prowadzone przez zespół, z radą programową z udziałem organizacji osób z niepełnosprawnościami | umowy z klientami B2B/B2G, polityka danych, roadmapa |
| Hosting | operator | chmura komercyjna w UE (niżej) |
| Aktualizacje danych | operator, automatycznie | ingest wg harmonogramu, monitoring źródeł |
| Aktualizacje oprogramowania i bezpieczeństwo | operator | zależności, HTTPS, sekrety, pentest raz w roku |
| Obsługa zgłoszeń | moderator operatora + właściciele obiektów | panel `/moderator`, kolejka i historia |
| Koszty | operator | abonamenty B2B, umowy B2G, granty |
| Rola Miasta | Miasto | publikuje otwarte dane, potwierdza licencje zbiorów, promuje usługę; **0 zł za utrzymanie bazy** |

## Hosting

Architektura nie zależy od jednego dostawcy ([deployment.md](../deployment.md) → „Moving to other
infrastructure”):

| Komponent | Prototyp | Zamiennik |
|---|---|---|
| Aplikacja web + API (Next.js) | Vercel, region fra1 (UE) — PR #44, w toku | dowolny host Node.js 22+ lub kontener |
| Baza Postgres + PostGIS | zarządzany Postgres (Neon) — PR #44, w toku | dowolny Postgres z PostGIS |
| Ingest | GitHub Actions cron, codziennie 03:17 UTC (`.github/workflows/ingest.yml`) — jest w `main`, działa po ustawieniu sekretu `DATABASE_URL` (bez niego jest pomijany z ostrzeżeniem) | cron, systemd timer, Kubernetes CronJob |
| Mapa bazowa | OpenFreeMap (bez klucza, atrybucja OSM) | dowolne kafle wektorowe MapLibre |
| Aplikacja iOS/Android | Capacitor, ładuje wdrożoną aplikację web przez HTTPS | — |

Uruchomienie na innej infrastrukturze: Postgres z PostGIS → `npm run db:migrate` → `npm run build`
→ host Node → harmonogram `npm run ingest -- --city <miasto>`. Kod nie używa funkcji dostępnych
tylko na Vercelu; ingest nigdy nie działa w czasie żądania użytkownika (R5).

## Aktualizacje danych

- Osobna aplikacja `apps/ingest`: adapter na źródło, każdy fakt z pochodzeniem (źródło, rekord,
  data pozyskania, licencja), dziennik uruchomień w tabeli `ingestion_runs`.
- Awaria źródła: ograniczone ponawianie, potem źródło dostaje status „awaria”, a aplikacja pokazuje
  ostatnią dobrą kopię z datą; nic nie jest kasowane. Źródło bez udanego odświeżenia przez dwa
  interwały jest pokazywane jako nieaktualne (`GET /sources`, strona „O danych”).
- **Źródło bez potwierdzonej licencji nie jest ładowane** — wymuszone w kodzie
  (`licenseConfirmed`). Dziś ładowane są OpenStreetMap, BIP Miasta Krakowa, BIP Małopolska
  i lista toalet z krakow.pl (licencja niekomercyjna, oznaczona); adaptery ZDMK (parking OZN) i ZTP
  (przystanki) są gotowe i czekają na potwierdzenie licencji przez Miasto, a toalety MSIP są
  wyłączone, bo warstwa nie jest danymi otwartymi.
- Poprawki faktów obiektywnych (np. liczba stopni) wracają do OpenStreetMap: przy faktach z OSM
  jest link „Edytuj w OpenStreetMap” (US-4.7).

## Bezpieczeństwo

Operator odpowiada za: HTTPS wszędzie, sekrety tylko w zmiennych środowiskowych, aktualizacje
zależności, limity i walidację zgłoszeń, dostęp moderatorów, test penetracyjny raz w roku.
Stan prototypu i plan: [privacy-security.md](privacy-security.md). Nie zbieramy informacji o
niepełnosprawności; profil zostaje w przeglądarce.

## Obsługa zgłoszeń

- Zgłoszenia bez konta trafiają do kolejki moderatora; decyzje: zatwierdź, odrzuć, do wyjaśnienia;
  historia „kto, co, kiedy”.
- Zatwierdzone zgłoszenie staje się faktem „Społeczność, zweryfikowane przez moderatora” i nie
  nadpisuje danych innych źródeł (różnica z faktem aktualnym = „Sprzeczne”; fakt starszy niż
  12 miesięcy ustępuje świeżemu).
- Obsada: moderator operatora 0,25–0,5 etatu w 1. roku **(szacunek)**; po uruchomieniu panelu
  właściciela (US-9.3) właściciele obiektów potwierdzają swoje dane (status „Deklaracja
  właściciela”, nigdy „certyfikat”).
- Cel obsługi: zgłoszenie rozpatrzone w ciągu 5 dni roboczych **(cel, nie zmierzony)**.

## Koszty i finansowanie

| Pozycja | 1. rok |
|---|---|
| Infrastruktura (hosting, baza, kopie, monitoring) | 800–2 000 zł/mies. **(szacunek)** |
| Moderacja i wsparcie | 0,25–0,5 etatu **(szacunek)** |
| Audyt WCAG, pentest | raz w roku **(szacunek: koszt do wyceny)** |

Finansowanie: abonamenty B2B (karta dostępności / widget, API), umowy B2G (white-label dla miast i
gmin) i granty (PFRON, fundusze UE) na pierwsze 12 miesięcy. Szczegóły i ceny: model biznesowy w
[hacktribe.md](hacktribe.md). Mieszkańcy i turyści nigdy nie płacą.

## Prawa i licencje

- Dane z OSM pozostają na ODbL 1.0 z atrybucją „© OpenStreetMap contributors”.
- Kod projektu jest na licencji **MIT** ([LICENSE](../../LICENSE), © 2026 Zespół Bez Progów),
  tak by po ewentualnym przeniesieniu praw majątkowych na sponsora nagrody operator mógł dalej
  legalnie hostować i rozwijać usługę (warunki przeniesienia **do potwierdzenia z Miastem**). MIT
  nie obejmuje danych: każde źródło ma własną licencję ([data-sources.md](../data-sources.md)).
- Audyt licencji zależności: **do zrobienia** ([deployment.md](../deployment.md) → Licences).

## Plan prac (cele, nie wyniki)

| Kiedy | Co |
|---|---|
| 0 mies. | prototyp: karta faktów, profile, pochodzenie danych, 3 przypadki błędów, widget, API, panel moderatora |
| 3 mies. | MVP na prawdziwym API, potwierdzone licencje źródeł miejskich, audyt WCAG, pilot z ok. 30 obiektami na Starym Mieście |
| 12 mies. | API v1 z SLA, 300+ zweryfikowanych obiektów, pierwsze miasto white-label |
| 24 mies. | 3–5 miast, integracje z systemami rezerwacji |

## Warunki uruchomienia w kolejnym mieście

Miasto to konfiguracja, bez zmian w interfejsie (KBB-32, [deployment.md](../deployment.md) → „Add a city”):

1. Plik `apps/ingest/src/cities/<miasto>.ts`: obszar (bbox), język, ustawienia mapy, lista źródeł.
   Wrocław (`wroclaw.ts`) jest przykładem na samym OpenStreetMap.
2. OpenStreetMap działa od razu; lokalne zbiory otwarte wymagają adaptera i **potwierdzonej
   licencji** (bez licencji nie ładujemy).
3. Nowa kategoria miejsc (np. apteki) to jeden wpis w `packages/contracts/src/categories.ts`.
4. Partner lokalny (NGO lub uczelnia) do weryfikacji pierwszych ~100 obiektów i finansowanie tych
   audytów.
5. Moderacja zgłoszeń po stronie operatora lub partnera.

Cel: 2–4 tygodnie od umowy do uruchomienia **(szacunek)**.
