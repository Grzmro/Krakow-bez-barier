# Kraków bez barier — teksty zgłoszenia (HackTribe)

> Teksty do wklejenia w formularz HackTribe, zgodne ze stanem `main` na **4.10.2026, ok. 03:20**
> (wykaz funkcji z numerami PR: [features.md](features.md)). Liczby z naszej bazy to odczyt lokalnej
> bazy demo z 4.10.2026, zasilonej tym samym ingestem co wdrożenie. Liczby oznaczone „szacunek” to
> nasze wyliczenia; resztę podajemy ze źródłem.
>
> **Przed wysłaniem uzupełnić** wszystkie pola `[DO UZUPEŁNIENIA: …]` (lista na końcu pliku).

## ID zespołu

**[DO UZUPEŁNIENIA: ID zespołu z HackTribe]**

## Tytuł projektu

Kraków bez barier — każde miejsce ma drugą stronę

## Opis rozwiązania

Kraków bez barier to aplikacja webowa, w której mieszkańcy i turyści sprawdzają, czy miejsce i droga do niego pasują do ich potrzeb. Działa też jako instalowalna PWA z trybem offline i jako aplikacja iOS/Android z tego samego kodu. Zamiast etykiety „dostępne / niedostępne” pokazujemy konkretne fakty: stopnie, próg, szerokość drzwi, podjazd, windę, nawierzchnię, toaletę dostosowaną, przewijak, ławkę i parking. Każdy fakt ma „drugą stronę” („Skąd wiemy?”): źródło, datę pozyskania, datę stanu według źródła, poziom wiarygodności, a przy danych z BIP i krakow.pl także cytat zdania i link do strony źródła.

Bez konta i bez pytań o zdrowie: użytkownik jednym kliknięciem włącza profil potrzeb („Wózek”, „Wózek dziecięcy” albo „Senior”). Profil to tylko progi (np. drzwi co najmniej 90 cm, bez stopni, winda, toaleta) i zostaje w przeglądarce. Aplikacja porównuje z nimi fakty i pokazuje werdykt: „Spełnia”, „Nie spełnia”, „Sprzeczne” albo „Brak danych”, a na karcie grupy „Blokuje / Pasuje / Nie wiadomo”. Brak informacji nigdy nie jest pokazywany jako dostępność. Brakujące albo błędne dane można uzupełnić, poprawić lub potwierdzić bez konta. Zgłoszenie trafia do panelu moderatora (kolejka, decyzja, historia „kto, co, kiedy”) i nigdy nie nadpisuje danych innego źródła: po zatwierdzeniu staje się osobnym faktem, a różnica z aktualnym faktem innego źródła jest pokazywana jako „Sprzeczne”.

Z karty miejsca wyznaczamy trasę („Prowadź”) z własnej pozycji albo z dowolnego miejsca: openrouteservice z profilem wózka i opcją „Unikaj schodów”. Na każdym odcinku pokazujemy nawierzchnię, schody, nachylenie i krawężniki ze źródłem; odcinek bez danych jest opisany jako „brak danych”, nigdy jako spełniający potrzeby. „Ruszamy” prowadzi krok po kroku, „Czytaj na głos” czyta kroki, a trasę można zapisać na telefonie i otworzyć bez internetu.

Te same dane trafiają do partnerów: hotel osadza kartę dostępności na swojej stronie jako widżet (`<iframe>`, bez konta), organizator generuje stronę „Dojazd i wejście bez barier” dla swojego obiektu (z najbliższymi przystankami i ich faktami), a aplikacje turystyczne i systemy rezerwacji pobierają dane przez publiczne API tylko do odczytu (OpenAPI 3.1, dokumentacja `/api/docs`), z licencją przy każdym źródle. Miasto dostaje panel `/miasto` ze statystyką barier, priorytetami napraw i danymi GUS.

**Co nas wyróżnia** (wszystko poniżej jest w kodzie, wykaz z numerami PR: `docs/submission/features.md`):
- **Dane miasta z cytatem, nie tylko OSM.** Fakty z deklaracji „Dostępność architektoniczna” w BIP Miasta Krakowa (23 miejsca instytucji kultury), z deklaracji dostępności w BIP Małopolska (7 wydawców, 11 budynków) i z listy toalet miasta na krakow.pl (24 z 65 toalet przypiętych do toalet z OSM). Przy każdym fakcie jest zdanie, z którego go odczytaliśmy, i link do strony.
- **Licencje pilnowane w kodzie.** Źródło bez potwierdzonej licencji nie jest ładowane ani podawane przez API. Warstwę toalet MSIP wyłączyliśmy, bo nie jest w katalogu OPEN DATA; adaptery ZTP i ZDMK są gotowe i czekają na licencję.
- **Konflikty i awarie pokazane, nie ukryte.** Sprzeczne źródła stoją obok siebie; gdy źródło nie odpowiada, zostaje ostatnia dobra kopia z datą, a OSM ma zapasowy kanał (ekstrakt Geofabrik).
- **Cały Kraków na mapie:** 36 928 obiektów z OSM i źródeł miejskich, w tym 14 072 ławki, 3 128 przystanków, 161 wind, z 41 868 faktami o dostępności (4.10.2026).
- **Trzy kanały B2B już działają:** widżet dla hotelu, strona wydarzenia, publiczne API.
- **Jeden kod → web, PWA z trybem offline i aplikacja iOS/Android**, po polsku i angielsku, z wyszukiwaniem głosowym.
- **WCAG 2.2 sprawdzany automatycznie:** audyt axe i snapshot ARIA w teście e2e każdego ekranu, na telefonie i desktopie.

## Problem

- Etykieta „dostępne” nie pozwala ocenić, czy konkretna osoba wjedzie, wejdzie i skorzysta z toalety.
- Danych szczegółowych prawie nie ma. W naszej bazie dla całego Krakowa (4.10.2026) są 7 753 lokale i instytucje. Ogólny tag `wheelchair` z OpenStreetMap ma 1 458 z nich (18,8%), a konkretną informację o wejściu (stopnie, próg, podjazd albo wejście z poziomu gruntu) tylko 35. **Żadne** nie ma szerokości drzwi. Dlatego dziś żadne miejsce nie spełnia profilu „Wózek” na samych danych otwartych, i mówimy to wprost, zamiast pokazywać zielone „dostępne”. Łączymy OSM z danymi miasta i moderowanymi zgłoszeniami, żeby te luki zamykać.
- 42% osób z potrzebami dostępności rezygnuje z miejsca, jeśli nie znajdzie informacji, a tylko 13% czuje się pewnie, idąc w nowe miejsce (Euan’s Guide Access Survey 2025, UK).
- Dane, które istnieją, są rozproszone (OSM, BIP-y, krakow.pl, warstwy ZTP i ZDMK), mają różną świeżość, różne licencje i czasem sobie przeczą. Miasto nie chce utrzymywać własnej bazy ręcznie.

## Grupa docelowa i sposób użycia

Prototyp skupia się na **osobach poruszających się na wózku** i **rodzicach z wózkami dziecięcymi**; trzeci profil jest dla seniorów. Według GUS (Bank Danych Lokalnych) w Krakowie mieszka 111 014 osób z niepełnosprawnością (NSP 2021) i 183 315 osób w wieku poprodukcyjnym, na 816 614 mieszkańców (2025). Kraków odwiedziło w 2025 r. 16,25 mln osób (MOT/UMK, Badanie ruchu turystycznego 2025).

Scenariusz: użytkownik wyszukuje miejsce (wpisując albo głosem; mapa i równoważna lista tekstowa), włącza profil „Wózek” i widzi werdykt z konkretem, np. „Brak danych · drzwi” i „Pasuje 3 z 4 potrzeb profilu”. W „Skąd wiemy?” sprawdza źródło, datę i cytat. Gdy czegoś brakuje, uzupełnia to w kilku krokach, bez konta; zgłoszenie od razu widać na karcie jako „Czeka na weryfikację”. Z karty wyznacza trasę z barierami i lukami w danych na odcinkach. Kartę można udostępnić linkiem. Szybkie akcje znajdują najbliższą toaletę dostosowaną, windę, ławkę albo aptekę. „W mojej okolicy” ustala pozycję na urządzeniu, a serwer dostaje tylko kratkę ok. 1 km. Hotel osadza tę samą kartę na swojej stronie, organizator generuje stronę wydarzenia, moderator zatwierdza zgłoszenia w panelu `/moderator`.

Dostępność cyfrowa (cel WCAG 2.2 AA): automatyczny audyt axe i snapshoty ARIA w teście e2e każdego ekranu (uruchamiane lokalnie przed każdym scaleniem; e2e nie jest w CI), pełna obsługa klawiaturą, lista równoważna mapie, „Krok po kroku” jako tekstowa wersja trasy, statusy rozróżnialne bez koloru (ikona + słowo), ograniczony ruch przy `prefers-reduced-motion`, deklaracja dostępności z listą ograniczeń. Interfejs jest po polsku i angielsku. Do zrobienia: testy z użytkownikami czytników ekranu i zewnętrzny audyt WCAG.

## Źródła danych oraz ocena świeżości i wiarygodności

Używamy danych publicznych z jawnymi warunkami ponownego wykorzystania (licencję każdego źródła pokazujemy przy danych), bez dostępu do systemów UMK/MJO i bez bazy utrzymywanej przez miasto. Pełny rejestr: `docs/data-sources.md` (sprawdzony 3–4.10.2026).

| Źródło | Co daje | Licencja / warunki | Odświeżanie | Gdy niedostępne |
|---|---|---|---|---|
| OpenStreetMap (Overpass; zapasowo ekstrakt Geofabrik) | miejsca, ławki, windy, parkingi, schody, krawężniki, przystanki (ścieżka dotykowa, wiata, ławka); `wheelchair`, toaleta, przewijak, kondygnacje, `check_date` | ODbL 1.0, „© OpenStreetMap contributors” | codziennie (cron) | ekstrakt Geofabrik z datą ekstraktu; gdy i on zawiedzie, ostatnia dobra kopia z datą |
| BIP Miasta Krakowa: „Dostępność architektoniczna” jednostek miejskich | winda, podjazd, toaleta, przewijak, parking, wejście z poziomu gruntu, szerokość drzwi — odczytane ze zdań, z cytatem; 19 stron, 23 miejsca | zasady ponownego wykorzystywania GMK, pkt III (także komercyjnie) | codziennie; data aktualizacji strony przy każdym fakcie | strona, która nie odpowiada, zostaje pominięta, jej fakty zostają |
| BIP Małopolska: deklaracje dostępności podmiotów publicznych | jak wyżej; 7 wydawców, 11 budynków, 32 fakty | ustawa o otwartych danych, sprawdzona dla każdego wydawcy; teatrów i opery nie czytamy (ustawa ich nie obejmuje) | codziennie; data zmiany deklaracji | jak wyżej |
| krakow.pl „Kraków bez barier”: Toalety ogólnodostępne | toalety dostosowane z rodzajem udogodnienia (platforma, winda, pochylnia, poziom 0); 24 z 65 przypiętych do toalet z OSM | **tylko niekomercyjnie** (informacje prawne krakow.pl); oznaczone na karcie źródła, wyłączalne zmienną | codziennie; stan strony z 15.09.2025 | ostatnia kopia z datą, oznaczona jako nieaktualna |
| GUS Bank Danych Lokalnych | liczby dla panelu miasta (osoby z niepełnosprawnością, wiek poprodukcyjny, muzea przystosowane) | dane publiczne GUS | odczyt 3.10.2026 | — |
| openrouteservice (HeiGIT, dane OSM) — tylko trasy, nie zapisujemy | geometria trasy, nawierzchnia, schody, nachylenie | warunki HeiGIT, atrybucja przy trasie; użycie komercyjne **do potwierdzenia** | na żądanie, po stronie serwera | komunikat, że trasa jest niedostępna; dane miejsc działają dalej |
| Zgłoszenia użytkowników (moderowane) | uzupełnienia, korekty, potwierdzenia, awarie wind i podjazdów | regulamin usługi | na bieżąco | — |
| Czekają na licencję (adaptery gotowe, dane **nie są** ładowane): ZDMK miejsca postojowe OZN, ZTP przystanki i GTFS-RT | — | **do potwierdzenia z miastem** | — | — |
| Wyłączone: MSIP toalety publiczne (`WT_WC_2023`) | — | warstwy nie ma w katalogu OPEN DATA MSIP, więc nie jest danymi otwartymi; „O danych” podaje powód | — | — |

**Model wiarygodności.** Każdy fakt ma źródło, datę pozyskania, datę stanu, licencję i poziom zaufania: *Potwierdzone* (publikacja miasta, zatwierdzone zgłoszenie, dwa niezależne potwierdzenia) → *Społeczność* (OSM) → *Odczytane automatycznie* (BIP, z cytatem) → *Zgłoszenie* (niezweryfikowane). Kolejność decyduje tylko o tym, który fakt pokazujemy pierwszy; rozbieżności między aktualnymi faktami nie rozstrzygamy wiarygodnością, tylko pokazujemy jako „Sprzeczne”. Modyfikatory: *Może być nieaktualne* (fakt starszy niż 12 miesięcy; ustępuje świeżemu), *Sprzeczne* (dwa aktualne źródła się nie zgadzają: pokazujemy obie wartości, nie uśredniamy, nigdy „Spełnia”), *Brak danych* (nigdy „dostępne”). Zgłoszenie nigdy nie nadpisuje danych innego źródła.

**Pobieranie.** Osobny proces ingest (codzienny cron) pobiera źródła przez adaptery i zapisuje fakty z pochodzeniem oraz dziennikiem uruchomień. Aplikacja nie odpytuje źródeł w czasie żądania. Źródło bez potwierdzonej licencji nie jest ładowane ani podawane przez API — reguła wymuszona w kodzie. Kolejne źródło to nowy adapter, kolejne miasto to plik konfiguracyjny (przykład: Wrocław na samym OSM).

**Trzy przypadki błędów w demo (na prawdziwych danych):**
1. **Dane niepełne** — Hangar Czyżyny (oddział Muzeum Inżynierii Miejskiej): BIP MK (stan na 19.03.2026) podaje wejście z poziomu gruntu, windę i toaletę dostosowaną, ale nie szerokość drzwi. Werdykt dla profilu „Wózek”: „Brak danych · drzwi”. Na żywo uzupełniamy drzwi zgłoszeniem, zatwierdzamy kontem demo moderatora i karta pokazuje nowy fakt ze źródłem.
2. **Dane rozbieżne** — toaleta w Sukiennicach: lista miasta (krakow.pl, 15.09.2025) „dostosowana, platforma”, OSM `wheelchair=limited`. Lista miasta ma ponad 12 miesięcy, więc jest oznaczona „Może być nieaktualne”, a obok stoi świeższe OSM. Po zatwierdzeniu zgłoszenia, które przeczy OSM, karta pokazuje „Sprzeczne” z oboma źródłami.
3. **Źródło niedostępne** — adresy `msip3.um.krakow.pl` z katalogu MSIP zwracały HTTP 404 (3.10.2026), więc awarie miejskich serwisów się zdarzają. W demo wywołujemy awarię źródła krakow.pl i pokazujemy, co widzi użytkownik: ostatnią kopię z datą i komunikat „Odświeżenie nie powiodło się”. Przełącznik dla moderatora jest w przygotowaniu (KBB-179); do tego czasu służy przełącznik serwera `SIMULATE_SOURCE_OUTAGE`.

Demo działa na prawdziwych danych. Dane przykładowe (np. zmiana zrobiona kontem demo moderatora) mają przy miejscu i fakcie oznaczenie „PRZYKŁAD”.

## Model biznesowy

**Darmowe dla ludzi, płatne dla tych, którzy zarabiają na dostępności.** Mieszkańcy i turyści nigdy nie płacą i nie potrzebują konta. Kod jest na licencji MIT, dane z OSM zostają na ODbL — płaci się za weryfikację, aktualność (SLA), integrację i wygodę. Ranking w aplikacji nigdy nie jest płatny.

| Produkt | Klient | Cena (propozycja) |
|---|---|---|
| Karta dostępności (widżet na stronę i do systemu rezerwacji, QR, statystyki) | hotele, lokale, muzea | od 49 zł/mies.; sieć 149 zł/mies. |
| Weryfikacja obiektu (status „Zweryfikowane — data”) | obiekty, gminy | zdalna 290 zł, na miejscu 590–990 zł |
| Karta wydarzenia | organizatorzy | 290–990 zł / wydarzenie |
| API danych o dostępności | aplikacje turystyczne, mapowe, rezerwacyjne | od 490 zł/mies.; 1 990 zł/mies. z SLA |
| White-label dla miast i gmin | samorządy, DMO (PFRON, EFS+) | wdrożenie 25–60 tys. zł + 2–6 tys. zł/mies. |

Motywacja klientów: 42% klientów z potrzebami dostępności rezygnuje bez informacji, 70% wraca tam, gdzie jest dostępnie (Euan’s Guide 2025); od 28.06.2025 Polski Akt o Dostępności (EAA) obejmuje rezerwacje online noclegów i wydarzeń. Benchmarki: AccessAble (UK) ok. 150 £ za przewodnik obiektu; Wrocław sfinansował z PFRON 650 audytów obiektów (2017).

Szacunek: ok. 450 tys. zł przychodu w 2. roku (Kraków + 2 miasta white-label), próg rentowności ok. 24. miesiąca, marża brutto na kliencie „Karta” ok. 80%. To wyliczenia bez listów intencyjnych; walidacja z obiektami to pierwszy krok pilotażu.

Kierunki rozwoju: panel właściciela obiektu, kolejne profile (osoba z bagażem, osoby niewidome), integracje z systemami rezerwacji, kolejne miasta w Polsce i regionie V4.

## Plan utrzymania poza infrastrukturą miasta

- **Właściciel i operator:** spółka z o.o. non-profit albo przedsiębiorstwo społeczne prowadzone przez zespół, z radą programową z udziałem organizacji osób z niepełnosprawnościami.
- **Hosting:** chmura komercyjna w UE po stronie operatora; szacunek 800–2 000 zł/mies. w 1. roku. Miasto nic nie hostuje.
- **Aktualizacje danych:** automatyczny ingest (cron) z dziennikiem uruchomień i statusem źródeł; poprawki faktów obiektywnych wracają do OpenStreetMap (link „Edytuj w OpenStreetMap” przy faktach z OSM).
- **Bezpieczeństwo:** operator odpowiada za HTTPS, aktualizacje zależności i pentest raz w roku. Już w prototypie: limity zgłoszeń na klienta, walidacja zakresów, pułapka na boty, usuwanie e-maili i telefonów z komentarzy, logowanie moderatora z blokadą po 5 nieudanych próbach. Nie zbieramy informacji o niepełnosprawności; profil zostaje w przeglądarce, a dokładna pozycja na urządzeniu (poza wyznaczaniem trasy z własnej pozycji, gdy trafia na serwer i do openrouteservice tylko w tym celu).
- **Obsługa zgłoszeń:** moderator operatora (0,25–0,5 etatu w 1. roku, szacunek) w panelu `/moderator` (kolejka, decyzje, historia); docelowo także właściciele obiektów.
- **Koszty:** abonamenty B2B (karta, API), umowy B2G (white-label) i granty (PFRON, UE) na pierwsze 12 miesięcy.
- **Rola miasta:** publikuje otwarte dane (najbardziej pomoże otwarta licencja dla warstw ZTP, ZDMK i MSIP) i promuje usługę; 0 zł za utrzymanie bazy.
- **Prawa autorskie:** kod na licencji MIT (plik `LICENSE`, © 2026 Zespół Kraków bez barier), tak by po przeniesieniu praw majątkowych na sponsora nagrody operator i kolejne miasta mogli dalej legalnie hostować i rozwijać usługę (warunki przeniesienia i moment publikacji kodu na tej licencji do potwierdzenia z Miastem; repozytorium jest dziś prywatne). Dane mają własne licencje (ODbL, zasady BIP, krakow.pl tylko niekomercyjnie) i nie są objęte MIT.
- **Roadmapa:** 0 mies. prototyp → 3 mies. MVP, widżet v1, audyt WCAG, pilotaż z 30 obiektami na Starym Mieście → 12 mies. API v1, 300+ zweryfikowanych obiektów, pierwsze miasto white-label → 24 mies. 3–5 miast, integracje z systemami rezerwacji.
- **Kolejne miasto:** plik konfiguracyjny (obszar OSM, lokalne źródła z potwierdzoną licencją, kategorie) — działa już w kodzie, przykład Wrocław; partner lokalny (NGO albo uczelnia), finansowanie audytów pierwszych ~100 obiektów; cel 2–4 tygodnie wdrożenia (szacunek).

Pełne materiały w repozytorium: `docs/submission/features.md` (wykaz funkcji), `docs/submission/jury-qa.md` (pytania jury), `docs/demo-script.md` (scenariusz pokazu i wideo), `docs/submission/privacy-security.md` (ochrona danych), `docs/submission/operations.md` (utrzymanie poza UMK), `docs/data-sources.md` (rejestr źródeł), `docs/deployment.md` (zależności, licencje, kolejne miasto).

## Instructions on how to open project

Tekst do pola „Instructions on how to open project”. Przycisk konta demo pokazuje się tylko, gdy na Vercelu jest
ustawione `MODERATOR_DEMO_TOKEN` (16+ znaków, np. `openssl rand -hex 12`); samego tokenu nie podajemy jury ani
nie wpisujemy do repozytorium — serwer wydaje sesję demo po kliknięciu. Trasy wymagają `ORS_API_KEY`.

> Aplikacja działa w przeglądarce bez logowania: **[DO UZUPEŁNIENIA: link do wdrożenia]**.
> Panel moderatora dla jury: **[DO UZUPEŁNIENIA: link do wdrożenia]/moderator** → przycisk „Wejdź na konto
> demonstracyjne (dla jury)” — bez tokenu i hasła (to samo konto otwiera panel miasta `/miasto`).
> Decyzje konta demonstracyjnego działają naprawdę: zatwierdzone zgłoszenie od razu zmienia kartę miejsca (link
> „Zobacz na karcie” w historii), ze źródłem „Konto demonstracyjne moderatora (zmiana tymczasowa)”. Po 30 minutach
> cofamy je automatycznie, a do tego czasu miejsce ma oznaczenie „PRZYKŁAD”. Ścieżka: otwórz dowolne miejsce →
> „Uzupełnij” albo „To się nie zgadza” → wyślij zgłoszenie → panel moderatora → w kolejce wybierz swoje zgłoszenie
> (najnowsze jest na końcu listy; kolejka zawiera też prawdziwe zgłoszenia innych osób) → „Zatwierdź” → „Zobacz na
> karcie”. Przykład: Hangar Czyżyny → „Uzupełnij” → „Szerokość drzwi” → 90 → po zatwierdzeniu jedyna brakująca
> potrzeba profilu „Wózek” (drzwi) ma już wartość ze źródłem i datą. Sesja konta demo trwa 12 godzin.

## Linki

- Demo: **[DO UZUPEŁNIENIA: link do wdrożenia]**
- Publiczne API i dokumentacja: **[DO UZUPEŁNIENIA: link do wdrożenia]/api/docs**
- Film (MP4, do 3 min, w otwartym, dostępnym miejscu — regulamin): **[DO UZUPEŁNIENIA: publiczny link do filmu MP4]**
- Prezentacja (PDF, do 10 slajdów): **[DO UZUPEŁNIENIA: link do PDF]**
- Repozytorium kodu: prywatne (decyzja zespołu), kod na licencji MIT. **[DO UZUPEŁNIENIA: czy i jak udostępniamy repozytorium jury]**
- Zespół: **[DO UZUPEŁNIENIA: imiona i nazwiska członków zespołu]**

## Do uzupełnienia przed wysłaniem

- `[DO UZUPEŁNIENIA: ID zespołu z HackTribe]`
- `[DO UZUPEŁNIENIA: link do wdrożenia]` (4 miejsca; po wpisaniu sprawdzić `/api/v1/health`, `/o-danych`, `/moderator`)
- `[DO UZUPEŁNIENIA: publiczny link do filmu MP4]` — regulamin wymaga filmu w otwartym, dostępnym repozytorium, a nasze repozytorium kodu jest prywatne
- `[DO UZUPEŁNIENIA: link do PDF]`
- `[DO UZUPEŁNIENIA: czy i jak udostępniamy repozytorium jury]`
- `[DO UZUPEŁNIENIA: imiona i nazwiska członków zespołu]`
- Decyzja zespołu: czy w `LICENSE` zostaje „Zespół Kraków bez barier”, czy wpisujemy imiona i nazwiska autorów (nazwa zespołu nie jest osobą prawną)
- Na Vercelu: `MODERATOR_DEMO_TOKEN` i `ORS_API_KEY` ustawione (bez nich przycisk konta demo i trasy nie działają)
