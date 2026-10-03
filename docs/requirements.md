# Kraków bez barier — wymagania funkcjonalne (epiki i user stories)

Source: team document by Bartłomiej Leśniewski, 3 Oct 2026 (copied verbatim, Polish). Scope source of truth together with [challenge.md](challenge.md).

> Known inconsistencies in the original, kept verbatim: two epics are numbered E8 (digital accessibility, privacy), so "E9"/"E10"/"E11" references in *Musimy* and the coverage table are shifted by one; "trasy (E6)" in *Do decyzji* means E7. User-story IDs (US-x.y) are the stable references.

## Kontekst i zakres

Budujemy aplikację webową dla każdego, kto chce sprawdzić, czy do miejsca da się wygodnie dotrzeć, a osoby z utrudnieniami dostają dodatkowo profil, który dopasowuje wyniki do ich potrzeb.
- Dla kogo: dla wszystkich użytkowników: mieszkańców i turystów, w tym osób z bagażem, seniorów, osób po urazie, rodziców z wózkami i osób na wózkach. Nikt nie musi niczego deklarować ani zakładać profilu.
- Warstwa podstawowa („Dla każdego”): wyszukanie miejsca, szybkie filtry cech (np. bez schodów, winda, toaleta, ławki) i karta konkretnych faktów ze źródłem, datą i wiarygodnością.
- Warstwa dodatkowa („Profile potrzeb”): opcjonalne profile porównują fakty z progami użytkownika i pokazują, co spełnia, co blokuje i czego nie wiadomo. W prototypie są trzy: „Wózek”, „Wózek dziecięcy” i „Senior”.
- Zgodność z dokumentem wyzwania: dokument wymaga ograniczenia prototypu do wybranej grupy lub rodzaju potrzeb. Spełniamy to dwoma profilami, które pokazujemy w demo („Wózek” i „Wózek dziecięcy”); profil „Senior” (US-2.8) jest dodatkiem ponad to ograniczenie, a kolejne profile to konfiguracja na później. Do potwierdzenia, że takie ujęcie jest akceptowalne.
- Główny scenariusz na żywo: wyszukuję miejsce, widzę fakty ze źródłem, datą i wiarygodnością, włączam profil i widzę, co mnie blokuje, zgłaszam poprawkę.
- Zasada nadrzędna: brak informacji nigdy nie jest pokazywany jako dostępność.
- Dane: OpenStreetMap, Otwarte Dane Krakowa, MSIP, dane.gov.pl, informacje od właścicieli obiektów i zgłoszenia użytkowników. Bez dostępu do systemów UMK/MJO i bez ręcznie utrzymywanej bazy po stronie Miasta.
- Persony w user stories: P1 każdy użytkownik (mieszkaniec, turysta, senior, osoba z bagażem lub po urazie), P2 osoba na wózku, P3 rodzic z wózkiem dziecięcym, P4 użytkownik klawiatury lub czytnika ekranu, P5 właściciel obiektu lub organizator, P6 moderator, P7 operator nowego miasta lub partner techniczny.
- Wagi oceny: użyteczność dla użytkowników 25%, jakość prototypu 20%, wiarygodność danych 15%, potencjał wdrożeniowy 20%, model biznesowy 20%.

## Musimy, możemy, nie możemy

Musimy dowieźć jeden scenariusz dla każdego użytkownika z opcjonalną warstwą profili dla wózka i wózka dziecięcego (E1–E3, E5, E6, E8, E9); trasy, dodatkowy profil „Senior” (US-2.8) i pozostałe profile to wartość dodana.

### Musimy

- Aplikacja działa dla każdego bez konta, bez profilu i bez pytań o niepełnosprawność: wyszukiwanie, filtry cech i karta faktów (E1).
- Konkretne bariery i udogodnienia: schody, progi, podjazdy, windy, szerokość wejścia, nawierzchnia, toaleta, miejsca odpoczynku, a nie tylko „dostępne” lub „niedostępne” (E1).
- Opcjonalne profile „Wózek” i „Wózek dziecięcy”, które dopasowują wyniki do progów użytkownika; to także spełnienie wymogu ograniczenia prototypu do wybranej grupy (E2).
- Źródło, data pozyskania lub potwierdzenia i poziom wiarygodności przy każdej informacji; dane niezweryfikowane wyraźnie odróżnione od potwierdzonych (E3).
- Sposób poprawiania błędnych i nieaktualnych danych (E4).
- Dane z otwartych źródeł, odświeżane automatycznie, z architekturą oddzielającą pozyskiwanie danych od prezentacji (E5).
- Tekstowa alternatywa dla wszystkiego, co jest tylko na mapie (E6).
- WCAG 2.2 AA jako cel; w prototypie klawiatura, czytnik ekranu, kontrast, czytelność (E8).
- Zasady ochrony danych, HTTPS i brak pytania o niepełnosprawność (E9).
- Łatwość wdrożenia u hoteli i organizatorów: co najmniej osadzany widget i API tylko do odczytu (E10, wersja minimalna).
- Sposób dodania kolejnego miasta, kategorii i źródła bez zmian w interfejsie (E11).
- Jedno pokazane na demo miejsce z danymi sprzecznymi, niepełnymi lub źródłem niedostępnym; dane przykładowe jednoznacznie oznaczone (E3, E5).

### Możemy (wartość dodana, nie wymóg)

- Kolejne profile: osoba z bagażem, osoba po urazie (E2).
- Dostępne trasy: dla każdego z opcją „unikaj schodów”, a z profilem z pełnymi progami (E7). Dokument wymaga miejsca lub trasy, więc to największa pozycja do świadomego wyboru.
- Panel właściciela obiektu z potwierdzaniem danych (E10).
- Wersja angielska dla turystów, geolokalizacja za zgodą, zdjęcia przy zgłoszeniach, lekkie konta.
- Deep link do edycji w OpenStreetMap, żeby poprawki wracały do źródła (E4).
- Demo drugiego miasta na samej konfiguracji (E11).

### Nie możemy (twarde ograniczenia z dokumentu)

- Zakładać dostępu do wewnętrznych systemów UMK, MJO ani jednostek miejskich.
- Zakładać ręcznie utrzymywanej bazy po stronie Miasta.
- Przedstawiać informacji niepotwierdzonej jako formalnego zapewnienia dostępności.
- Pokazywać braku informacji jako dostępności miejsca lub trasy.
- Wymagać podania niepełnosprawności, jeśli wystarczą preferencje dotyczące barier i udogodnień.
- Pobierać i komercyjnie wykorzystywać danych tylko dlatego, że są w internecie: każde źródło wymaga sprawdzenia licencji, a OpenStreetMap atrybucji.

### Świadomie poza zakresem prototypu

- Profile dla osób niewidomych, niesłyszących i w spektrum: wymagają innego modelu informacji i testów; architektura profili ma to umożliwić później.
- Jedna zbiorcza ocena miejsca (punkty, gwiazdki): ukrywałaby braki danych i różne potrzeby użytkowników.
- Aplikacja natywna, rezerwacje, płatności.
- Pełne pokrycie Krakowa danymi; wystarczy wybrany obszar z dobrą jakością.
- Pełna zgodność z WCAG 2.2 AA; w prototypie wymagana jest kontrola głównego scenariusza i lista ograniczeń z planem ich usunięcia.
- Stały hosting po hackathonie (potrzebna jest tylko propozycja modelu).

## Epiki i user stories

Każdy epik kończy się czymś, co użytkownik robi od początku do końca, a kryteria akceptacji da się sprawdzić na demo. Priorytet: M = musimy, C = możemy. E1 i E3–E6 dotyczą każdego użytkownika, E2 to opcjonalna warstwa profili. Wartości liczbowe oznaczone jako propozycja wymagają potwierdzenia.

### E1 — Wyszukanie miejsca i karta faktów (dla każdego) · M · P1

Cel e2e: wchodzę na stronę bez żadnych ustawień, znajduję miejsce i w minutę wiem, jakie ma schody, windę, toaletę i miejsca odpoczynku oraz skąd to wiadomo.
- US-1.1 (M) Jako każdy użytkownik chcę zacząć od razu, bez konta, profilu i pytań o siebie, żeby szybko sprawdzić miejsce.
    - Strona startowa to wyszukiwarka i kategorie; żadne pole nie pyta o niepełnosprawność; profil można włączyć później (E2).
- US-1.2 (M) Jako turysta lub mieszkaniec chcę wyszukać miejsce po nazwie lub adresie albo przeglądać kategorie (restauracje, muzea, toalety, hotele), żeby szybko znaleźć to, czego szukam.
    - Podpowiedzi podczas pisania, wyniki jako lista i na mapie (E6).
    - Brak wyników daje komunikat i propozycję szerszego wyszukiwania.
- US-1.3 (M) Jako każdy użytkownik chcę zawęzić wyniki szybkimi filtrami cech (bez schodów, winda, toaleta dostosowana, ławki, parking dla osób z niepełnosprawnością, przewijak), np. gdy mam walizkę, kule albo dziecko.
    - Filtry działają bez profilu.
    - Domyślnie filtr pokazuje miejsca ze znaną cechą; przełącznik „Pokaż też miejsca bez danych” dodaje je z oznaczeniem „Brak danych”.
- US-1.4 (M) Jako użytkownik chcę otworzyć kartę miejsca z konkretnymi faktami: wejście (stopnie, próg, szerokość drzwi, podjazd), winda, nawierzchnia dojścia, toaleta dostosowana, miejsca odpoczynku, parking.
    - Każda cecha ma wartość z jednostką (np. 85 cm) i status wiarygodności z E3.
    - Karta nie zawiera zbiorczego „dostępne” ani punktacji.
- US-1.5 (M) Jako użytkownik chcę widzieć na liście wyników krótkie podsumowanie faktów (np. „wejście bez stopni · winda · toaleta: brak danych”), żeby porównać miejsca bez otwierania kart.
    - Brak danych jest nazwany wprost, nigdy pominięty.
- US-1.6 (M) Jako użytkownik chcę, gdy czegoś nie wiadomo, zobaczyć kontakt do obiektu (telefon, strona), jeśli jest w danych, i przycisk „Uzupełnij” z E4.
- US-1.7 (M) Jako użytkownik chcę udostępnić stały link do karty miejsca opiekunowi lub znajomemu.
    - Link otwiera się bez konta i instalacji, z moim profilem albo bez niego.

### E2 — Profile potrzeb: dopasowanie wyników (opcjonalna warstwa) · M (wózek, wózek dziecięcy) / C (pozostałe) · P2, P3

Cel e2e: osoba z utrudnieniem jednym kliknięciem włącza profil i dla każdego miejsca widzi, co spełnia jej progi, co ją blokuje i czego nie wiadomo; wyłączenie profilu wraca do widoku dla każdego.
- US-2.1 (M) Jako osoba na wózku chcę włączyć profil „Wózek” jednym kliknięciem, żeby wyniki odpowiadały moim progom bez ujawniania diagnozy.
    - Gotowe progi (propozycja: brak stopni lub próg do 2 cm, szerokość wejścia co najmniej 90 cm, toaleta dostosowana, winda przy piętrach).
    - Żadne pole nie pyta o niepełnosprawność; profil zapisuje się tylko w przeglądarce.
- US-2.2 (M) Jako rodzic z wózkiem dziecięcym chcę włączyć profil „Wózek dziecięcy”, który ma inne progi niż „Wózek” i uwzględnia przewijak oraz toaletę rodzinną.
    - Wartości domyślne do ustalenia na podstawie danych dostępnych w OSM.
- US-2.3 (M) Jako użytkownik profilu chcę zmienić progi (maksymalny próg, minimalna szerokość wejścia, brak stopni, winda, toaleta, nawierzchnia) i przywrócić domyślne.
- US-2.4 (M) Jako użytkownik profilu chcę na liście i na karcie widzieć werdykt względem moich progów: „Spełnia”, „Nie spełnia”, „Brak danych”.
    - Trzy stany różnią się ikoną, tekstem i kolorem.
    - Miejsce bez danych dostaje „Brak danych”, nigdy „Spełnia”.
    - Mogę ukryć miejsca, które nie spełniają moich progów.
- US-2.5 (M) Jako użytkownik profilu chcę zobaczyć na karcie trzy grupy: „Blokuje”, „Pasuje” i „Nie wiadomo”, żeby sam ocenić przydatność miejsca.
- US-2.6 (M) Jako użytkownik chcę przełączyć profil („Wózek” i „Wózek dziecięcy”) w kilka sekund.
    - Wyniki przeliczają się bez przeładowania strony i bez utraty wyszukiwania.
- US-2.7 (M) Jako użytkownik chcę wyłączyć profil jednym kliknięciem i wrócić do widoku dla każdego.
    - Aplikacja nigdy nie wymaga profilu.
- US-2.8 (C) Jako senior, osoba z bagażem lub po urazie chcę gotowy profil z odpowiednimi progami (ławki i miejsca odpoczynku, brak stopni i winda, krótkie dystanse).
    - Dodanie profilu to konfiguracja progów i listy ważnych cech, bez zmian w kodzie interfejsu.

### E3 — Wiarygodność danych: źródło, data, status · M · P1, P2, P3, P4

Cel e2e: przy każdej informacji wiem, skąd jest, jak jest stara i na ile mogę jej ufać; gdy dane są sprzeczne lub ich brak, aplikacja mówi to wprost.
- US-3.1 (M) Jako użytkownik chcę przy każdej cesze widzieć źródło, datę pozyskania lub ostatniego potwierdzenia i status wiarygodności.
    - Statusy: potwierdzone, niezweryfikowane, nieaktualne, sprzeczne, brak danych.
    - Status jest widoczny bez klikania (ikona i tekst), szczegóły rozwijają się także klawiaturą.
- US-3.2 (M) Jako użytkownik chcę, żeby dane niezweryfikowane (zgłoszenia, informacje bez potwierdzenia) były wyraźnie odróżnione od potwierdzonych.
    - Etykieta tekstowa „Niezweryfikowane”, nie tylko kolor.
    - Podsumowanie i werdykt zbudowane z takich danych mają dopisek „niepotwierdzone”.
- US-3.3 (M) Jako użytkownik chcę, gdy źródła się sprzeczają, zobaczyć obie wartości z źródłem i datą oraz ostrzeżenie, a nie jedną wybraną po cichu.
    - Sprzeczna cecha nigdy nie daje werdyktu „Spełnia”.
- US-3.4 (M) Jako użytkownik chcę, żeby brak informacji był pokazany jako „Brak danych”, a nie jako dostępność.
    - Test automatyczny: miejsce bez danych nigdy nie dostaje „Spełnia” ani nie pojawia się jako potwierdzone w filtrach.
- US-3.5 (M) Jako użytkownik chcę wiedzieć, że dana może być nieaktualna.
    - Cecha starsza niż próg (propozycja: 12 miesięcy) ma oznaczenie „Może być nieaktualne” i datę ostatniego potwierdzenia.
- US-3.6 (M) Jako użytkownik chcę, gdy źródło danych jest niedostępne, zobaczyć ostatnie znane dane z datą i komunikatem, że odświeżenie się nie powiodło.
    - Aplikacja działa dalej na ostatniej dobrej kopii.
- US-3.7 (M) Jako oglądający demo chcę, żeby dane przykładowe były jednoznacznie oznaczone.
    - Znacznik „PRZYKŁAD” na karcie i stały baner w całej aplikacji.
- US-3.8 (M) Jako użytkownik chcę mieć stronę „O danych” dostępną z każdej karty: lista źródeł, licencje, częstotliwość odświeżania, sposób weryfikacji i zasada liczenia wiarygodności.
    - Widoczna atrybucja © OpenStreetMap contributors.

### E4 — Zgłaszanie, potwierdzanie i poprawianie danych · M · P1, P6

Cel e2e: będąc na miejscu, poprawiam błędną informację w kilkanaście sekund, moderator ją zatwierdza, a kolejni użytkownicy widzą aktualną wartość.
- US-4.1 (M) Jako użytkownik chcę zgłosić, że informacja jest błędna lub nieaktualna, jednym kliknięciem przy danej cesze („To się nie zgadza”).
    - Formularz: która cecha, jaka jest prawdziwa wartość (wybór lub liczba w cm), opcjonalny komentarz.
    - Bez konta; po wysłaniu widzę potwierdzenie.
    - Zgłoszenie pojawia się obok istniejącej wartości jako „Niezweryfikowane” z datą, więc użytkownicy widzą sprzeczność zamiast cichej podmiany (US-3.3).
- US-4.2 (M) Jako użytkownik chcę potwierdzić cechę („Potwierdzam, byłem tu”), żeby inni wiedzieli, że informacja jest aktualna.
    - Potwierdzenie aktualizuje datę ostatniego potwierdzenia.
    - Po przekroczeniu progu niezależnych potwierdzeń (propozycja: 2) status zmienia się na „Potwierdzone przez społeczność”.
- US-4.3 (M) Jako użytkownik chcę uzupełnić brakującą cechę (np. zmierzoną szerokość wejścia) z poziomu sekcji „Nie wiadomo”.
- US-4.4 (M) Jako moderator chcę przejrzeć kolejkę zgłoszeń i je zatwierdzić, odrzucić lub oznaczyć do wyjaśnienia, żeby kontrolować jakość danych.
    - Panel za logowaniem, widok „co się zmieni na karcie” przed zatwierdzeniem.
    - Zatwierdzenie ustawia status i źródło „Społeczność, zweryfikowane przez moderatora” oraz datę; odrzucone zgłoszenie znika z widoku publicznego.
    - Historia zmian pokazuje kto, co i kiedy zmienił.
- US-4.5 (M) Jako użytkownik chcę, żeby zgłoszenia były chronione przed nadużyciem, żeby dane nie zostały zaśmiecone.
    - Limit zgłoszeń na sesję i adres, walidacja zakresów (np. szerokość 10–300 cm), ochrona przed automatami.
- US-4.6 (C) Jako użytkownik chcę dołączyć zdjęcie wejścia jako dowód.
    - Ograniczenie rozmiaru, usuwanie metadanych lokalizacji ze zdjęcia, możliwość usunięcia przez zgłaszającego.
- US-4.7 (C) Jako użytkownik chcę przejść do edycji obiektu w OpenStreetMap jednym kliknięciem, żeby poprawka trafiła do źródła, z którego korzystają też inni.
- US-4.8 (C) Jako użytkownik chcę zgłosić tymczasową awarię windy lub podjazdu („Zgłoś awarię”) i zobaczyć awarie zgłoszone przez innych, żeby nie jechać do miejsca, w którym dziś nie wjadę.
    - Zgłoszona awaria jest od razu widoczna na karcie jako „Niezweryfikowane” (źródło: zgłoszenie odwiedzających, czas) i w werdykcie profilu jako niepotwierdzona bariera; bez moderacji, bez konta.
    - Inni odpowiadają „Potwierdzam awarię” lub „Działa”; po progu potwierdzeń (konfiguracja, 2) awaria jest „Potwierdzona przez społeczność”, ale nadal ma poziom zgłoszenia użytkownika; „Działa” zdejmuje awarię, a bez potwierdzeń wygasa po 48 h.
    - Jeden głos danego rodzaju na awarię z urządzenia na dobę; nie można zgłosić awarii urządzenia, którego według faktów nie ma.
    - Moderator widzi w panelu (zakładka „Awarie”) aktywne awarie z miejscem i głosami i może usunąć spam lub fałszywe zgłoszenie — znika wtedy z karty i z werdyktów.

### E5 — Automatyczne pozyskiwanie i odświeżanie danych · M · P1, P7

Cel e2e: użytkownik widzi dane Krakowa, które odświeżają się same, a zespół i partnerzy dodają kolejne źródło bez zmian w interfejsie.
- US-5.1 (M) Jako użytkownik chcę widzieć miejsca i cechy dostępności pobrane z OpenStreetMap dla wybranego obszaru Krakowa.
    - Mapowanie tagów OSM (m.in. wheelchair, step_count, kerb, width, surface, ramp, toilets:wheelchair, bench, changing_table) na model cech; lista tagów do potwierdzenia na wiki OSM.
    - Brak tagu oznacza „Brak danych”; wartość „ograniczone” (wheelchair=limited) jest pokazana jako taka, bez zaokrąglania do tak lub nie.
    - Dane zachowują licencję ODbL i widoczną atrybucję.
- US-5.2 (M) Jako użytkownik chcę widzieć dane z zasobów publicznych (Otwarte Dane Krakowa, MSIP przez WMS/WFS, dane.gov.pl), o ile zasób istnieje i jego licencja na to pozwala.
    - Każde źródło ma wpis w rejestrze: zasób, licencja, format, częstotliwość, sposób weryfikacji; bez wpisu i zgody licencyjnej nie pobieramy.
    - Ryzyko: nie wiemy jeszcze, czy te zbiory zawierają cechy dostępności; wymaga zbadania na początku prac.
- US-5.3 (M) Jako użytkownik chcę, żeby dane odświeżały się automatycznie, a ja widziałem datę pozyskania przy każdej cesze.
    - Własna częstotliwość dla każdego źródła (propozycja: OSM codziennie lub co tydzień, zasoby miejskie zgodnie z ich aktualizacją).
- US-5.4 (M) Jako użytkownik chcę, żeby awaria źródła nie psuła aplikacji.
    - Ponawianie, ostatnia dobra kopia, wpis „Ostatnia udana aktualizacja” na stronie „O danych”; zachowanie widoczne dla użytkownika jak w US-3.6.
- US-5.5 (M) Jako użytkownik nie chcę duplikatów: to samo miejsce z kilku źródeł ma być jedną kartą.
    - Dopasowanie po lokalizacji i nazwie; każda cecha zachowuje własne źródło; sprzeczności trafiają do US-3.3.
- US-5.6 (M) Jako partner techniczny chcę dodać nowe źródło jako osobny adapter z konfiguracją, bez zmian w warstwie prezentacji.
    - Warstwy: pozyskiwanie, znormalizowany magazyn, API, interfejs; schemat architektury w dokumentacji.
    - Test: dodanie sztucznego źródła nie wymaga zmiany interfejsu.
- US-5.7 (M) Jako oglądający demo chcę zobaczyć trzy przygotowane przypadki: miejsce z danymi sprzecznymi, miejsce z danymi niepełnymi i niedostępne źródło.
    - Niedostępność źródła da się wywołać przełącznikiem testowym i pokazać na żywo.

### E6 — Mapa z równoważną alternatywą tekstową · M · P1, P4

Cel e2e: znajduję miejsca na mapie albo w równoważnym widoku tekstowym i docieram do tej samej karty, także bez używania mapy.
- US-6.1 (M) Jako użytkownik chcę widzieć wyniki na mapie: bez profilu oznaczone neutralnie, z włączonym profilem w stanach „Spełnia”, „Nie spełnia”, „Brak danych”, „Sprzeczne”, rozróżnialnych bez koloru (kształt lub ikona i etykieta).
- US-6.2 (M) Jako użytkownik czytnika ekranu chcę mieć widok listy równoważny mapie, żeby nie tracić żadnej informacji.
    - Wszystko, co jest na mapie, jest też na liście (nazwa, adres, fakty lub werdykt, odległość).
    - Lista działa z klawiatury i czytnikiem ekranu.
- US-6.3 (M) Jako użytkownik chcę obsługiwać mapę bez gestów: przyciskami przybliżania i oddalania oraz klawiszami strzałek, z alternatywą dla przeciągania.
- US-6.4 (M) Jako użytkownik chcę widzieć na karcie opis lokalizacji tekstem (adres i wskazówkę dojścia do wejścia, jeśli jest w danych).
- US-6.5 (M) Jako użytkownik chcę widzieć atrybucję © OpenStreetMap contributors na mapie.
- US-6.6 (C) Jako użytkownik chcę zobaczyć miejsca „w mojej okolicy” po zgodzie na geolokalizację.
    - Lokalizacja nie jest zapisywana na serwerze; bez zgody działa wyszukiwanie po adresie.

### E7 — Dostępne trasy · C · P1, P2, P3

Cel e2e: wskazuję start i cel, widzę trasę dopasowaną do tego, co dla mnie ważne (unikaj schodów albo pełny profil), oraz każdą barierę i lukę w danych na jej przebiegu.
- US-7.1 (C) Jako każdy użytkownik chcę wyznaczyć trasę z punktu A do B z opcją „unikaj schodów”, a z włączonym profilem z uwzględnieniem jego progów (maksymalne nachylenie, krawężniki, nawierzchnia).
    - Start i cel to adres albo miejsce z E1.
    - Routing oparty o dane OpenStreetMap z profilem pieszym i dla wózka; narzędzie do wyboru po sprawdzeniu licencji i hostingu (np. GraphHopper lub Valhalla).
- US-7.2 (C) Jako użytkownik chcę widzieć bariery wzdłuż trasy (stopnie, krawężniki, nachylenia, nawierzchnię) z źródłem, datą i statusem jak w E3.
    - Komunikat „Trasa nie zawiera znanych barier” zawsze z informacją, na ilu odcinkach brakuje danych.
- US-7.3 (C) Jako użytkownik czytnika ekranu chcę opis trasy krok po kroku, równoważny mapie.
- US-7.4 (C) Jako użytkownik chcę, gdy nie ma trasy spełniającej moje ustawienia, dostać komunikat o tym oraz najlepszą alternatywę z jawną listą barier.
    - Alternatywa nigdy nie udaje trasy spełniającej ustawienia.
- US-7.5 (C) Jako użytkownik chcę, żeby cel trasy kończył się przy wejściu do miejsca i pokazywał jego cechy z karty.
- Ryzyko: jakość tras zależy od kompletności tagów OSM dla krawężników i stopni w Krakowie; trzeba to sprawdzić na wybranym obszarze, zanim zdecydujemy o wejściu w E7.

### E8 — Dostępność cyfrowa aplikacji (WCAG 2.2 AA jako cel) · M · P4

Cel e2e: cały główny scenariusz da się przejść samą klawiaturą i z czytnikiem ekranu bez utraty informacji, także w widoku dla każdego i z włączonym profilem.
- US-8.1 (M) Jako użytkownik klawiatury chcę przejść wyszukiwanie, kartę miejsca, włączenie profilu i zgłoszenie bez myszy.
    - Widoczny fokus, który nie jest przesłonięty przez inne elementy, logiczna kolejność, link „Przejdź do treści”.
- US-8.2 (M) Jako użytkownik czytnika ekranu chcę, żeby strona miała poprawne nagłówki, landmarki i etykiety formularzy.
    - Liczba wyników i zmiany po filtrowaniu lub zmianie profilu są ogłaszane; statusy wiarygodności są czytane jako tekst.
- US-8.3 (M) Jako użytkownik słabowidzący chcę wysokiego kontrastu i powiększenia bez utraty treści.
    - Kontrast tekstu 4,5:1, elementów interfejsu i ikon 3:1; powiększenie do 200%; informacja nigdy tylko kolorem.
- US-8.4 (M) Jako użytkownik telefonu chcę wygodnych celów dotykowych i alternatyw dla przeciągania.
    - Cele co najmniej 24×24 px CSS.
- US-8.5 (M) Jako użytkownik chcę mieć deklarację dostępności prototypu: co działa już teraz, jakie są znane ograniczenia i kiedy je usuniemy.
- US-8.6 (C) Jako turysta z zagranicy chcę korzystać z aplikacji po angielsku.

### E8 — Prywatność i bezpieczeństwo użytkownika · M · P1, P2, P5

Cel e2e: korzystam z aplikacji i zgłaszam poprawki bez ujawniania wrażliwych informacji i wiem, jakie dane o mnie powstają.
- US-8.1 (M) Jako użytkownik nie chcę podawać informacji o niepełnosprawności: do dopasowania wyników wystarczą moje ustawienia dotyczące barier i udogodnień (patrz US-1.1).
- US-8.2 (M) Jako użytkownik chcę przeczytać na jednym ekranie, jakie dane są zbierane, po co i jak długo są przechowywane.
    - Ustawienia zostają w przeglądarce; zgłoszenia zawierają tylko to, co wpisałem.
    - Bez reklamowych trackerów; analityka bez identyfikatorów osobistych (decyzja zespołu).
- US-8.3 (M) Jako użytkownik chcę, żeby cała aplikacja działała przez HTTPS, a panel moderatora i zgłoszenia były chronione.
    - Logowanie moderatora z limitem prób i bez zagadek poznawczych (zgodnie z WCAG 3.3.8).
- US-8.4 (C) Jako zgłaszający chcę móc wycofać własne zgłoszenie za pomocą linku z potwierdzenia.

### E9 — Wdrożenie u partnerów: widget, API i panel właściciela · M (widget i API) / C (panel) · P4, P6

Cel e2e: hotel lub organizator w kilka minut osadza dostępność swojego obiektu na własnej stronie, a partner pobiera te same dane przez API.
- US-9.1 (M) Jako hotel lub organizator chcę osadzić na swojej stronie widget z cechami dostępności mojego obiektu przez fragment kodu do wklejenia.
    - Działa bez konta; pokazuje źródło, daty, statusy i atrybucję; spełnia te same wymagania dostępności co aplikacja; ma link do pełnej karty.
- US-9.2 (M) Jako partner techniczny (system rezerwacyjny, aplikacja turystyczna) chcę pobrać dane przez publiczne API tylko do odczytu.
    - Format JSON z dokumentacją OpenAPI; każda cecha ze źródłem, datą i statusem; informacja o licencji danych w odpowiedzi; limity zapytań.
- US-9.3 (C) Jako właściciel obiektu chcę zobaczyć, co aplikacja pokazuje o moim obiekcie, i potwierdzić lub poprawić dane.
    - Weryfikacja właściciela (np. link wysłany na e-mail powiązany z obiektem).
    - Dane od właściciela mają źródło „Właściciel obiektu” i status „Deklaracja właściciela”, nigdy „Certyfikat dostępności”; przechodzą moderację jak w E3.4.
- US-9.4 (C) Jako organizator wydarzenia chcę wygenerować stronę lub link „Dojazd i wejście bez barier” dla miejsca wydarzenia.
- US-9.5 (C) Jako pracownik miasta chcę zobaczyć zbiorcze statystyki barier, luk w danych i zgłoszeń oraz jawny ranking miejsc do naprawy lub uzupełnienia danych, żeby planować działania.
    - Tylko dane zbiorcze, bez danych osobowych; brak danych liczy się jako „Brak danych”, nigdy jako „dostępne”; dane PRZYKŁAD pominięte lub oznaczone.
    - Kryteria i wagi rankingu są pokazane w panelu; ranking można pobrać jako CSV (z informacją, jeśli plik jest ucięty).
    - Dostęp za logowaniem moderatora.

### E10 — Kolejne miasta, kategorie i źródła · M (konfiguracja) / C (demo) · P6

Cel e2e: operator uruchamia kolejne miasto przez konfigurację i dostaje te same funkcje bez zmian w interfejsie.
- US-10.1 (M) Jako operator chcę dodać miasto przez konfigurację (obszar OSM, lista źródeł, język, ustawienia domyślne) bez zmian w kodzie interfejsu; Kraków jest pierwszą konfiguracją.
- US-10.2 (M) Jako operator chcę dodać kategorię miejsc (np. apteki, urzędy) przez konfigurację mapowania tagów.
- US-10.3 (M) Jako wdrożeniowiec chcę mieć opis zależności od zewnętrznych dostawców, licencji danych i komponentów oraz instrukcję przeniesienia rozwiązania na inną infrastrukturę.
- US-10.4 (C) Jako oglądający prezentację chcę zobaczyć drugie miasto uruchomione tylko na danych OpenStreetMap, żeby ocenić, jak łatwo się skaluje.

## Materiały wymagane do oceny

Oprócz funkcji produktu trzeba dostarczyć materiały i opisy, które da się przygotować równolegle do epików; 40% oceny to wdrożenie i model biznesowy, więc nie są dodatkiem.
- [ ] Opis rozwiązania i problemu, który rozwiązuje
- [ ] Prototyp lub demonstracja głównego scenariusza: określona grupa, co najmniej jedno miejsce (lub trasa), konkretne bariery i udogodnienia
- [ ] Informacja o grupie docelowej i sposobie wykorzystania rozwiązania
- [ ] Rejestr źródeł danych: pochodzenie, licencja, aktualność, sposób weryfikacji, częstotliwość pobierania, postępowanie przy niedostępności
- [ ] Propozycja modelu biznesowego i kierunków rozwoju (właściciele obiektów, hotele, organizatorzy wydarzeń, zarządcy nieruchomości, systemy rezerwacyjne, dostawcy map i aplikacji turystycznych)
- [ ] Plan przejścia od prototypu do usługi: podmiot odpowiedzialny, pozyskiwanie i weryfikacja danych, finansowanie hostingu i utrzymania, plan prac, warunki uruchomienia w kolejnym mieście
- [ ] Propozycja uruchomienia poza infrastrukturą UMK: kto odpowiada za hosting, aktualizacje, bezpieczeństwo, obsługę zgłoszeń i koszty
- [ ] Opis zasad ochrony danych i bezpieczeństwa: zakres zbieranych danych, ochrona zgłoszeń i kont, bezpieczne połączenia
- [ ] Zależności od zewnętrznych dostawców, licencje danych i komponentów, możliwość przeniesienia na inną infrastrukturę, sposób dodania kolejnego miasta
- [ ] Kontrola dostępności głównego scenariusza (klawiatura, czytnik ekranu, kontrast, mapa w formie tekstowej) z listą ograniczeń i planem ich usunięcia
- [ ] Wykaz funkcji już dostępnych i elementów wymagających dalszych prac
- [ ] Przygotowane trzy przypadki demo: dane sprzeczne, dane niepełne, źródło niedostępne, z wyjaśnieniem, co zobaczy użytkownik
- [ ] Prezentacja w PDF, maksymalnie 10 slajdów
- [ ] Film z działania, maksymalnie 3 minuty, w otwartym i dostępnym repozytorium
- [ ] Opcjonalnie: repozytorium kodu, zrzuty ekranu, link do demonstracji

## Ryzyka, otwarte pytania i kolejność prac

Największe ryzyko to jakość danych: nie wiemy jeszcze, ile cech dostępności faktycznie jest w OpenStreetMap i zasobach miejskich, dlatego pierwszym krokiem powinien być krótki przegląd danych.

### Do decyzji zespołu

- Potwierdzić grupę docelową: osoby na wózkach i rodzice z wózkami dziecięcymi.
- Zdecydować, czy w prototypie robimy tylko miejsca, czy także trasy (E6), po sprawdzeniu pokrycia danych.
- Wybrać obszar demo (cały Kraków czy np. Stare Miasto i Kazimierz), bo od niego zależy liczba miejsc z kompletnymi danymi.
- Zatwierdzić progi startowe: szerokość wejścia 90 cm, próg 2 cm, nieaktualność po 12 miesiącach, 2 potwierdzenia do statusu „Potwierdzone przez społeczność”.
- Rozstrzygnąć, czy dane niezweryfikowane wchodzą do werdyktu z dopiskiem „niepotwierdzone”, czy go nie zmieniają.
- Wybrać zgłoszenia bez konta (propozycja) albo lekkie konta.
- Wybrać analitykę: żadna albo bez identyfikatorów osobistych.

### Ryzyka

- Brak cech w zasobach miejskich: zbiory z Otwartych Danych Krakowa, MSIP i dane.gov.pl mogą nie zawierać cech dostępności; do sprawdzenia na starcie.
- Luki w OpenStreetMap: wiele „Brak danych” jest uczciwym wynikiem, ale demo potrzebuje kilku dobrze opisanych miejsc, które można uzupełnić zgłoszeniami.
- Licencje: OSM wymaga atrybucji i ma zasady dotyczące baz pochodnych; zasoby miejskie trzeba sprawdzić po jednym; nie pobieramy stron właścicieli obiektów tylko dlatego, że są publiczne.
- Jakość zgłoszeń: spam i pomyłki; stąd moderacja, limity i walidacja w E3.
- Zakres: dziesięć epików to więcej niż prototyp; E6, panel właściciela i zdjęcia są pierwsze do odcięcia.

### Proponowana kolejność

1. Przegląd danych, a następnie E4, E1 i E2: szkielet pełnego scenariusza z prawdziwymi danymi.
2. E5 i E7 równolegle z interfejsem, żeby dostępność nie była poprawiana na końcu.
3. E3 i E8: zgłaszanie, moderacja, prywatność.
4. E9 i E10: widget, API, konfiguracja miasta.
5. E6 i pozycje „Możemy”, jeśli zostanie czas.

## Pokrycie wymagań z dokumentu źródłowego

Każde wymaganie z dokumentu wyzwania ma swoje miejsce w epiku lub w materiałach do oceny.

| Wymaganie z dokumentu | Gdzie w tym planie |
| --- | --- |
| Konkretne bariery i udogodnienia, nie tylko „dostępne/niedostępne” | E1 (US-1.3, US-1.4), E4 (US-4.1) |
| Źródło, data i poziom wiarygodności przy każdej informacji | E2 |
| Dane niezweryfikowane odróżnione od potwierdzonych | US-2.2, E3 |
| Sposób poprawiania błędnych i nieaktualnych danych | E3 |
| Dane z dostępnych źródeł, bez ręcznej bazy Miasta | E4 |
| Brak dostępu do systemów UMK i MJO | Sekcja „Nie możemy”, US-4.2 |
| Potrzeby wybranej grupy użytkowników | E1 (US-1.1), US-1.7 |
| Brak informacji nie oznacza dostępności | US-1.3, US-2.4 |
| Dane sprzeczne, niepełne lub niedostępne źródło | US-2.3, US-2.6, US-4.4, US-4.7 |
| Dane przykładowe jednoznacznie oznaczone | US-2.7 |
| Oddzielenie pozyskiwania danych od prezentacji, dodawanie źródeł | US-4.6, E10 |
| WCAG 2.2 AA: klawiatura, czytnik ekranu, kontrast, tekst dla mapy | E5, E7 |
| Ochrona danych, bez pytania o niepełnosprawność | E8 |
| Łatwość wdrożenia u hoteli i organizatorów | E9 |
| Licencje, zależności, przenoszalność, kolejne miasto | E10, materiały do oceny |
| Hosting, finansowanie i utrzymanie poza UMK, model biznesowy | Materiały do oceny |
