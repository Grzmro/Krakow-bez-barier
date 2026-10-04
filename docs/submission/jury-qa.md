# Pytania jury: gotowe odpowiedzi

Odpowiedzi na pytania, które jury najpewniej zada po pokazie (z oceny „jury” z 4.10.2026). Każda
liczba ma źródło i datę. Liczby z bazy to odczyt **lokalnej bazy demo 4.10.2026 ok. 03:20**, zasilonej
tym samym ingestem co wdrożenie (OSM z ekstraktu Geofabrik, BIP MK, BIP Małopolska, krakow.pl). Na
wdrożeniu mogą się nieznacznie różnić; przed pokazem sprawdź je zapytaniami z końca pliku.

## 1. „Ile miejsc w Krakowie spełnia dziś profil Wózek? Widzę same »Brak danych«.”

**Odpowiedź:** „Dziś zero, i to jest pomiar problemu, a nie błąd. Profil Wózek wymaga drzwi
szerokich na co najmniej 90 cm. W żadnym z otwartych źródeł, które czytamy, nie ma szerokości drzwi
dla żadnego miejsca w Krakowie: w krakowskim OpenStreetMap jej nie ma, a deklaracje BIP mówią
o windach i toaletach, nie o drzwiach. Inna aplikacja pokazałaby tu zielone »dostępne« na podstawie
jednego tagu. My mówimy wprost, czego brakuje.

*(Następne dwa zdania mów tylko wtedy, gdy scena 3 pokazu się udała.)*
„Pokazaliśmy na żywo, jak to się zmienia: Hangar Czyżyny ma z BIP wejście z poziomu gruntu, windę
i toaletę, brakowało tylko drzwi. Ktoś je zmierzył, moderator zatwierdził i miejsce spełnia profil.”

„Drogi uzupełniania są trzy: zgłoszenie odwiedzającego
z moderacją, weryfikacja przez obiekt (nasz płatny produkt) i odczyt deklaracji BIP z cytatem.
Panel dla miasta (`/miasto`) pokazuje, gdzie braków jest najwięcej.”

Dowody:
- Próg drzwi w profilu: `minDoorWidthCm: 90` dla Wózka, 70 dla Wózka dziecięcego i Seniora
  (`apps/web/src/domain/profiles.ts`). Matcher zawsze sprawdza wejście i drzwi; bez faktu o drzwiach
  potrzeba ma stan „nie wiadomo”, więc werdykt nie może być „Spełnia” w żadnym profilu
  (`apps/web/src/domain/matcher.ts`).
- Faktów `door_width_cm` w bazie: **0** (wszystkie źródła, odczyt 4.10.2026).
- 7 753 miejsca w kategoriach lokali i instytucji (restauracje, sklepy, hotele, zabytki, apteki,
  toalety, muzea, teatry, inne). 2 388 z nich ma co najmniej jeden fakt o dostępności, 1 458 ma
  ogólny tag `wheelchair` z OSM, a tylko 35 ma konkret o wejściu (stopnie, próg, podjazd albo wejście
  z poziomu gruntu) (odczyt 4.10.2026).
- Hangar Czyżyny, `GET /api/v1/places/<id>?profile=wheelchair` (4.10.2026): wejście, winda,
  toaleta „spełnia · niepotwierdzone”; jedyna nieznana potrzeba to „drzwi”.

## 2. „Czy możecie używać danych miasta komercyjnie? Skąd pewność co do licencji?”

**Odpowiedź:** „Źródło bez potwierdzonej licencji nie jest ładowane ani podawane przez API. To reguła w kodzie,
nie w regulaminie. BIP Miasta Krakowa: zasady ponownego wykorzystywania, pkt III, pozwalają też na
użycie komercyjne. BIP Małopolska: ustawa o otwartych danych, sprawdzona osobno dla każdego z 7
wydawców; teatrów i opery nie czytamy, bo ustawa ich nie obejmuje. krakow.pl, czyli lista toalet
miasta, ma licencję niekomercyjną. Tak ją oznaczamy na karcie źródła i wyłączamy jedną zmienną.
Warstwy toalet MSIP nie ma w katalogu OPEN DATA, więc jej nie pokazujemy, a strona »O danych« mówi
dlaczego. Adaptery przystanków ZTP i miejsc parkingowych ZDMK są gotowe i czekają na licencję.
Miasto może pomóc jednym ruchem: opublikować te warstwy na otwartej licencji.”

Dowody: `docs/data-sources.md` (rejestr, licencje sprawdzone 3–4.10.2026); bramka
`licenseConfirmed` w ingest, `isWithheld` w `apps/web/src/server/sources.ts` (KBB-133);
`WITHHELD_SOURCES=krakow-pl-toilets` wyłącza listę miasta.

## 3. „Na jakiej licencji jest kod i co z prawami, które przechodzą na sponsora nagrody?”

**Odpowiedź:** „Kod jest na licencji MIT (plik `LICENSE`, »© 2026 Zespół Kraków bez barier«).
Wybraliśmy ją po to, żeby po przeniesieniu praw majątkowych na sponsora nagrody operator i kolejne
miasta mogli dalej legalnie hostować i rozwijać usługę. Repozytorium jest dziś prywatne, więc kiedy
i jak kod zostanie opublikowany na tej licencji, chcemy ustalić z Miastem. MIT obejmuje tylko kod. Dane mają własne licencje:
OpenStreetMap ODbL z atrybucją, BIP według zasad ponownego wykorzystania, krakow.pl tylko do użytku
niekomercyjnego. Aplikacja pokazuje licencję przy każdym źródle.”

Do potwierdzenia: audyt licencji zależności npm (`docs/deployment.md` → Licences), warunki
przeniesienia praw i moment publikacji kodu (challenge.md → IP: prawa majątkowe przechodzą na
sponsora nagrody).

## 4. „Kto to utrzyma po hackathonie i za co?”

**Odpowiedź:** „Niezależny operator: spółka non-profit albo przedsiębiorstwo społeczne, z radą
programową z udziałem organizacji osób z niepełnosprawnościami. Hosting to według naszego szacunku
800–2 000 zł miesięcznie w pierwszym roku. Płacą go obiekty i partnerzy: karta dostępności od 49 zł
miesięcznie, weryfikacja obiektu, karta wydarzenia, API, umowy white-label z gminami, a na start
granty (PFRON, UE). Miasto niczego nie hostuje i nie utrzymuje bazy, tylko publikuje otwarte dane.
Dane odświeża codzienny cron, a gdy źródło padnie, zostaje ostatnia dobra kopia z datą.”

Dowody: `docs/submission/operations.md`, `.github/workflows/ingest.yml` (codziennie), kwoty
oznaczone w `hacktribe.md` jako szacunki.

## 5. „Co z prywatnością? Zbieracie dane o niepełnosprawności?”

**Odpowiedź:** „Nie. Mieszkańcy i turyści nie mają kont. Profil to tylko progi, na przykład liczba
stopni i szerokość drzwi, i zostaje w przeglądarce. Z pytaniem do serwera idą same progi, bez
identyfikatora. »W mojej okolicy« wysyła serwerowi tylko kratkę około 1 km, nie dokładną pozycję.
Trasa dostaje pozycję tylko do wyznaczenia trasy, a w linku jest ona zaokrąglona do około 100 m.
Zgłoszenia nie mają e-maila, IP ani zdjęć; e-maile i telefony w komentarzach wycinamy. Nie ma
reklam, analityki ani pikseli śledzących.”

Dowody: `docs/submission/privacy-security.md`; siatka 0,01° w `apps/web/src/lib/nearby.ts`
(KBB-172); tekst „Pozycję wysyłamy tylko do wyznaczenia trasy, w linku zaokrągloną do ok. 100 m” na
ekranie trasy (`i18n/pl/route.ts`).

## 6. „Jak uruchomić to w innym mieście?”

**Odpowiedź:** „Miasto to plik konfiguracyjny: obszar OpenStreetMap, lista źródeł z potwierdzoną
licencją, kategorie. Przykład Wrocławia na samym OSM jest w kodzie. Kolejne źródło to nowy adapter
z tym samym kontraktem faktów. Do startu potrzeba lokalnego partnera (NGO albo uczelni) i moderatora.
Według naszego szacunku wdrożenie zajmie 2–4 tygodnie.”

Dowody: `apps/ingest/src/cities/` (konfiguracja Krakowa i Wrocławia), `docs/deployment.md`
(„Moving to other infrastructure”).

## 7. „Gdzie są dane sprzeczne i co się dzieje, gdy źródło nie działa?”

**Odpowiedź:** „Gdy dwa aktualne źródła się nie zgadzają, pokazujemy »Sprzeczne« z obiema
wartościami, źródłami i datami. Nigdy nie uśredniamy i nigdy nie dajemy wtedy »Spełnia«. Fakt
starszy niż 12 miesięcy ustępuje świeżemu i jest oznaczony »Może być nieaktualne«. W samych danych
otwartych toaleta w Sukiennicach to właśnie taki przypadek: lista miasta z 15.09.2025 jest starsza
niż rok, więc stoi obok OSM jako możliwie nieaktualna. »Sprzeczne« pojawia się, gdy zatwierdzone
zgłoszenie przeczy świeżemu faktowi z OSM, i to pokazaliśmy. Pokazaliśmy też awarię źródła: dane
zostają, z datą, a »O danych« mówi, że źródło jest niedostępne.”

Dowody: `apps/web/src/domain/resolver.ts` (rozbieżność świeżych faktów = konflikt; stare liczą się
tylko bez świeżych); w bazie z 4.10.2026 jedyne rozbieżności między źródłami otwartymi to 3 toalety
(krakow.pl z 15.09.2025 kontra OSM), wszystkie rozstrzygnięte regułą 12 miesięcy. Zatwierdzone
zgłoszenie jest osobnym, świeżym faktem (`server/reports/drizzle-store.ts`), więc rozbieżność z OSM
daje „Sprzeczne”.

## Sprawdzenie liczb przed pokazem

Zapytania tylko do odczytu na bazie, na której działa demo. Liczby się zmienią po każdym nowym
ingeście (np. dodatkowe apteki z innego źródła); wtedy podaj nowe, z datą odczytu.

```sql
-- fakty o szerokości drzwi (pyt. 1)
select count(*) from facts where status = 'active' and attribute = 'door_width_cm';
-- miejsca w kategoriach lokali i instytucji (pyt. 1)
select count(*) from places
where category in ('restaurant','shop','hotel','monument','pharmacy','other','toilet','museum','theatre');
-- fakty według źródła (MSIP jest w bazie ze starego seeda, ale API ich nie podaje)
select source_id, count(*) from facts where status = 'active' group by 1 order by 2 desc;
```
