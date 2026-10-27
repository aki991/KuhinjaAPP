# Kuhinja po meri

Mobilna aplikacija za stolare: sastavljanje kuhinje, konstrukcioni obračun, trenutno menjanje materijala i okova i ponude za mušterije. Redizajn je urađen direktno u postojećem projektu, uz očuvanje kalkulacionog mehanizma i lokalne IndexedDB baze.

**Demo obračun — proveriti konstrukciju pre proizvodnje. Sve početne cene su izmišljeni primeri, a ne tržišne ponude.**

## Drveni vizuelni identitet

Izgled prati dostavljenu referencu „Vaše kuhinje“: svetla drvena pozadina i kartice, tamna drvena navigacija i primarna dugmad, fotografija poslednjeg projekta i stolarski amblem. Priložene originalne slike nalaze se u `public/brand/`; tema za sve ekrane i dijaloge je u `src/wood-theme.css`. Tehnički crtež zadržava svetlu, čitljivu podlogu i istu geometriju. Nazivi projekata, brojevi elemenata i sačuvane ponude prikazuju stvarne lokalne podatke. „Prikaži sve“ otvara postojeću pretragu ponuda.

Logo, teksture i sve fotografije deo su lokalnog PWA keša. Novi ikona/boje manifest-a usklađeni su sa temom. Provereni su telefon 360×800, 390×844 i 430×932, desktop, dijalozi, fullscreen, funkcije kalkulatora i offline učitavanje svih vizuelnih resursa. Snimci su u `test-results/drveni-*.png`; svi postojeći testovi su zadržani.

## Pokretanje

Potreban je Node.js 22.12+ (provereno sa Node.js 24).

```powershell
npm install
npm run dev -- --port 5188 --strictPort
```

Otvorite http://localhost:5188. Port 5188 izabran je zato što je 5173 već koristila druga lokalna aplikacija.

Produkcioni PWA build:

```powershell
npm run build
npm run preview -- --port 4188 --strictPort
```

Otvorite http://localhost:4188. Vite razvojni server služi za razvoj; service worker i stvarni offline režim uključeni su u produkcionom build-u.

## Najkraća demonstracija

1. Početna → **Nastavi poslednji projekat** / **Kuhinja Petrović**.
2. **Cena → Promeni materijale i okove → Klizači → Ekonomični**.
3. Cena odmah pada sa **239.118,06 RSD** na **200.868,06 RSD**.

Pripremljeni primer sadrži dva fiokara sa po tri fioke: 6 × (6.000 − 900) = **30.600 RSD** manje za nabavku klizača. Uz matematičku maržu od 20%, prodajna cena pada za **38.250 RSD**. Ukupna cena i promena u odnosu na početak optimizacije prikazuju se samo na ekranu cene i optimizacije. Početna i sastavljanje kuhinje nemaju prikaz ukupne cene.

Za duži scenario: promenite MDF u univer, šarke u osnovne, primenite sačuvanu varijantu **Premium**, u **Podešavanja → Cenovnik** izmenite cenu MDF-a, vratite se na **Cena → Opcije obračuna i ponude → Preračunaj po novom cenovniku → Potvrdi novi obračun**, pa sačuvajte ponudu. U **Cena → Ponuda za mušteriju → Napravi PDF** dobijate lokalni PDF bez nabavnih cena i marže.

## Novi mobilni tok

**Početna → Nova kuhinja → dužina zida → Dodaj elemente.** U sekciji **Kuhinja** dodajte elemente, dodirnite šemu za izmenu dimenzija ili označite element iz liste. Dugi pritisak od 450 ms na telefonu pokreće prevlačenje; kratak pokret skroluje. Dodirom kartice otvara se editor sa dugmadima **Levo / Desno**, dupliranjem, premeštanjem i brisanjem. U editoru, **Dodatna podešavanja** sadrže dodelu zidu i mesto u redu. Kada završite raspored, donja navigacija **Cena** otvara obračun.

Donja navigacija ima četiri sekcije: **Početna, Kuhinja, Cena, Izgled**. Ikona podešavanja u zaglavlju otvara dve stranice: **Opšte** (podešavanja i rezervne kopije) i **Cenovnik** (postojeći artikli, cene i uvoz). Sačuvane ponude su dostupne sa početne strane. Aktivni projekat se ne ponavlja u listi ostalih poslednjih projekata.

Osnovni tekst i kontrole imaju 16 px ili više; naslovi su 24–28 px, dimenzije u editoru 24 px, sporedne oznake i donja navigacija najmanje 14 px. Glavne kontrole imaju visinu 48–56 px. Napredni izbori i detalji troškova otvaraju se na zahtev.

### Zidovi, pozicije i migracija

- IndexedDB koristi **verziju 7**, sa istim tabelama. Pripadnost zidu i redu (`placement.wall`, `placement.row`) i redosled (`placement.order`) čuvaju se u ponudi, radnoj kopiji i varijantama. `offset` je samo izvedeni podatak za kompatibilnost: svaki put se ponovo računa iz redosleda i širina. Cenovnici, cene, klijenti, dimenzije, izbori i ID-jevi ormara se ne brišu i ne menjaju.
- Verzija konstrukcionih pravila ostaje **1.0.0**. `engine.ts`, `construction.ts` i `catalog.ts` nisu menjani redizajnom. Regresioni testovi potvrđuju iste iznose.
- Stari projekti nisu imali podatke o stvarnim zidovima. Prvi raspored zato prati sačuvani redosled na zidu A, odvojeno za donji i viseći red. Dužina A prilagodi se postojećem nizu. To je početni raspored za pregled; majstor treba da dodeli stvarne zidove i izmerene dužine.
- Prava kuhinja počinje zidom A; L dodaje B, U dodaje B/C. Ostrvo je posebna grupa. Zidovi A/B/C i ostrvo mogu se dodati i ručno. Dužina svakog zida se posebno menja dodirom njegove mere.
- Donji i visoki elementi dele donji red; viseći imaju nezavisan red sa istom razmerom i početnom tačkom. Količina znači uzastopne primerke iste stavke i prevlači se kao grupa. Novi element ili duplikat ide na kraj odgovarajućeg reda. Promena širine ili količine pomera naredne elemente; brisanje zatvara prazninu. Ne menjaju se zidovi, širine ni broj ormara radi uklapanja.
- Zauzetost je dužina dužeg reda, uključujući namerno rezervisane razmake, bez dvostrukog sabiranja donjih i visećih elemenata. Rerna i frižider računaju se kroz svoje ormare, jednom. Radna ploča, sokla i dekorativne obloge ostaju u listi, ali ne zauzimaju dodatnu dužinu reda.
- **Razmak** se dodaje u biblioteci Donji / Viseći / Dodaci. Ima podesivu širinu, može da se izmeni, duplira, obriše i premesti. Čuva se u `layout.spacers`, zasebno od `Offer.elements`, pa ne menja broj ormara, obračun materijala, okove ni cenu. Preostalo slobodno mesto ostaje na kraju reda.
- Migracija v2 → v3 pretvara postojeće pozitivne praznine između apsolutnih pozicija u stavke „Razmak“. Raniji podaci ne sadrže podatak da li je praznina bila namerna, pa se radi očuvanja podataka čuva svaka postojeća praznina; neželjeni razmak korisnik može obrisati. Prethodna preklapanja slažu se po redosledu uz dostupnu napomenu o proveri rasporeda. Migriraju se i varijante i radna kopija.
- Pri prevlačenju prikazuju se pokretna oznaka i linija mesta ubacivanja. Zadržavanje iznad kartice drugog zida 350 ms prikazuje taj zid; zatim se stavka otpušta u njegovom redu. Neuspešno ili otkazano prevlačenje ne menja podatke. Donji/visoki ormari ostaju kompatibilni samo sa donjim redom, viseći sa visećim; razmaci mogu u oba. Model konstrukcije se ne menja zbog prevlačenja.
- Prekoračenje zida je označeno upozorenjem i crvenom bojom odgovarajućih elemenata. Premeštanje preko dužine zida ostaje dozvoljeno uz jasno upozorenje: aplikacija ne smanjuje elemente i ne seli ih na drugi zid. Šema se horizontalno skroluje, a tokom prevlačenja automatski pomera prikaz pri njegovim ivicama.
- JSON rezervne kopije ranijeg formata i dalje se prihvataju i dobijaju raspored pri uvozu. Kopije sa neispravnim zidovima/pozicijama odbijaju se pre zamene podataka.

## Jedinstveni 2D prikaz

Sekcija **Kuhinja** odmah otvara jedinstveni 2D SVG prikaz. Jednostavni prikaz i prekidač režima su uklonjeni; raniji projekti i podešavanja baze ostaju sačuvani. Zidovi A/B/C i ostrvo imaju zasebne elevacije, uz zajedničke funkcije `packLayout` i `relocateItem`.

Frontovi, vrata, broj fioka, aparati, namerni razmaci, zona sokle/nogica, radne ploče i obloge crtaju se u zajedničkoj razmeri. Frontovi imaju unutrašnji okvir i oznaku otvaranja; rerna tamno staklo, prozor izražen ram i refleksije, a frižider oznake odeljaka kada raspoloživa veličina dozvoljava čitljiv tekst. Isti renderer koristi se za pojedinačne kartice ispod crteža. Oznake elemenata su iznad visećih i ispod donjih; prostor iznad aparata i namerni razmaci ostaju stvarni podaci projekta.

Dugme **Kote** uključuje/isključuje detaljne dimenzije u mm. Ukupna širina zida ostaje prikazana i u čistom pregledu. Kote donjeg i visećeg reda su na odvojenim linijama ispod kuhinje; kratki segmenti dobijaju dodatne redove da se brojevi ne preklapaju. Tekst ostaje 14 px pri zumiranju. Uključivanje kota dodaje potreban prostor ispod crteža bez promene skale, pozicija, cene ili baze. Za sitnije detalje koristite dva prsta za zumiranje i **Uklopi**, a crtež pomerajte prstom. Dodirom elementa ili njegove kartice otvara se postojeći editor. **Levo / Desno / Dupliraj / Pomeri / Obriši** dostupni su u editoru. Dugi pritisak pokreće prevlačenje, a običan pokret pomera crtež. Razmaci su vidljivi u karticama i pri izboru/prevlačenju; u čistom pregledu ne prekrivaju prozor ili druge objekte.

Provereni su novi frontovi i aparati, Kote na 360/390/430 px, odvojene dimenzione linije, izmena širine uz trenutno ažuriranje kota i fullscreen prikaz. Snimci: `test-results/detaljan-pregled.png`, `test-results/detaljan-pregled-kote.png`, `test-results/detaljni-elementi.png`.

Automatski kadar koristi okvir kuhinjskih elemenata i raspoloživu širinu. Visina prostorije i udaljeni prozori/prepreke ne utiču na skalu kuhinje. Donji elementi bez visećih imaju kompaktan kontejner; oba reda i visoki ormari koriste više visine, do razumne granice mobilnog ekrana. Dugi nizovi zadržavaju čitljive frontove uz horizontalno pomeranje. Početni prikaz stranice Kuhinja već je uklopljen. **Uklopi** smešta celu kuhinju aktivnog zida, uključujući visoke elemente i uključene kote, u raspoloživi okvir bez horizontalnog ili vertikalnog skrola crteža, i na telefonu širine 360 px. Pri tome se čuvaju proporcije; visina prostorije i udaljene prepreke ne umanjuju elemente. Ručno zumiranje ponovo omogućava pomeranje i čuva centar pogleda. Puna prostorija i objekti ostaju dostupni pomeranjem; kota ukupne visine je vidljiva uz oznaku prekida kada deo zida izlazi iz kadra. Stvarne dimenzije, raspored i sačuvani podaci ostaju isti.

**Izgled u 2D prikazu** u editoru elementa sadrži smer otvaranja, staklo, opcioni uređaj i montažnu visinu. Dodaci imaju i opcioni položaj od početka zida; bočna obloga se spreda prikazuje svojom debljinom. Klasične ručke prate izbor otvaranja, GOLA se crta samo za tipove koje podržava postojeći konstruktivni model, a push nema ručke. Ovi vizuelni izbori ne dodaju materijal, uređaj ili okov u obračun.

**Okviri i mere** iznad prikaza otvara podešavanja aktivnog zida: dužinu zida, nogice, razmak iznad ploče, visinu zida i prozore/vrata/stubove/niše. Objekti imaju udaljenost od početka zida, širinu, visinu i donju ivicu od poda. Pored dugmeta prikazan je slobodan prostor donjeg i visećeg reda; ako je na zidu most, prikazuje se i slobodan prostor za most, koji deli viseći red. Preklapanja i izlazak iz mera daju upozorenje. Viseći front koji se preklapa sa visokim ormarom je isečen na crtežu, uz upozorenje; koordinate i količine se ne pomeraju radi skrivanja problema. Ovo je pogled spreda, bez provere sudara u dubini.

Migracija **v3 → v4** dodaje opcionu konfiguraciju `Offer.elevation` i vizuelne atribute `KitchenElement.visual`, uz očuvanje rasporeda i obračuna. Čuvaju se u radnoj kopiji, ponudi, varijantama i JSON kopiji. Nove kopije se proveravaju pre zamene baze. Referentna slika nije bila prisutna u prilogu, pa je izgled napravljen prema tekstualnom opisu.

## Nova biblioteka i dobavljački cenovnici

Na stranici **Kuhinja**, ispod dugmeta „Dodaj element“, izbor **Donji / Viseći / Visoki / Ostali** prikazuje postojeće elemente i svih 92 elementa iz priloženog kataloga, ukupno **144 izbora** uključujući namerni razmak. Ostali obuhvataju mostove, završetke, uređaje i ostrvske elemente. Sličice koriste isti renderer i izabrani materijal kao crtež kuhinje; crteži iz priloga bezbedno su ugrađeni u aplikaciju i dostupni offline. Dodir kartice odmah dodaje element na kraj odgovarajućeg reda aktivnog zida i vraća korisnika na prikaz kuhinje. Ostrvski tipovi koriste zasebnu grupu/zid ostrva. Dimenzije i položaj menjaju se u postojećem editoru; namerni razmak ostaje posebna stavka rasporeda.

Svaki tip ima prepoznatljiv šematski SVG sa odgovarajućim brojem vrata/fioka, staklom, policama ili oznakom uređaja. Za sedam varijanti iz priloga koje dele proverenu konstrukciju koriste se postojeća pravila uz njihove stvarne dimenzije i broj frontova. Ostale su vidljivo označene „Precizan obračun nije dostupan“. Mogu se dodati, izmeniti i sačuvati kao **nepotpun projekat**, ali ne dobijaju izmišljeni materijal/okov ili trošak. Ponuda i PDF ostaju blokirani dok projekat ima nepotpun obračun. Ostali podržani elementi računaju se neizmenjenim pravilima. Migracije baze **v6 → v7 → v8** dodaju biblioteke u postojeću tabelu šablona, bez promene sačuvanih elemenata i cena.

CSV/XLSX uvoz u **Podešavanja → Cenovnik** podržava šifru, naziv, proizvođača, dobavljača, kategoriju, jedinicu, dimenzije u mm, cenu, valutu, PDV i korisnički rabat. Cena u fajlu je **bez PDV-a**; kada su PDV ili rabat uneti, nabavni trošak računa se kao `cena × (1 − rabat/100) × (1 + PDV/100)`. Prazna opcionalna polja zadržavaju staro ponašanje i stare iznose. Ponovni uvoz spaja artikal po šifri i dobavljaču, čuva njegov ID i pre potvrde prikazuje staru, novu cenu i razliku. Mapiranje zaglavlja pamti se po dobavljaču u lokalnoj bazi i JSON kopiji. Uvoz i obračun rade offline; nema automatskog preuzimanja kataloga sa sajtova dobavljača.

## Pogled odozgo i izbor izgleda

Dugme **Odozgo** pored zidova otvara zajednički tlocrt svih zidova i ostrva; **Spreda** vraća elevaciju. Filteri **Donji / Viseći / Sve** koriste stvarne širine, dubine, redosled i namerne razmake. Donji prikaz uključuje i visoke elemente. Dodirom elementa otvara se isti editor. Zumiranje, Uklopi, kote, izbor zida i fullscreen dostupni su i u pogledu odozgo. Promena pogleda ne menja raspored, dimenzije niti obračun.

Na stranici Kuhinja dugme **Prostor** menja oblik postojećeg projekta i dodaje potrebne zidove. Ako promena uklanja zid sa elementima, razmacima ili preprekama, korisnik potvrđuje njihovo premeštanje na zid A; stavke i njihove dimenzije se čuvaju. Ostrvo ostaje zasebno dostupno. **Položaj ostrva** podešava udaljenost njegovih najbližih ivica od zidova A, B i C u mm, a suprotne udaljenosti se preračunavaju. Položaj se čuva u projektu i rezervnoj kopiji, dok opcija **Automatski položaj** vraća automatski raspored. Aplikacija upozorava na preklapanje sa elementima ili izlazak iz prostora između zidova.

Zidovi su povezani redom **A → B → C**, pod pravim uglovima. Ostrvo se prikazuje unutar plana ako ima dovoljno mesta za prolaz, inače odvojeno ispod zidova. Kraj A povezan je sa početkom B, a kraj B sa početkom C. Ugaoni element na kraju prethodnog zida rezerviše svoju stvarnu dubinu na početku narednog; ugaoni element na početku narednog zida rezerviše kraj prethodnog. Donji i viseći red računaju se zasebno. Zauzeće se izvodi iz postojećih elemenata pri svakom pakovanju, uključujući promenu dubine, brisanje i prevlačenje. Nema duplog artikla ili troška za deo ugla na susednom zidu. Slobodna dužina i upozorenje prekoračenja uključuju ugao. Ugao koji nije uz spoj zidova dobija upozorenje, bez tihog pomeranja ili promene dimenzija.

Stranica **Izgled** sadrži kartice **Korpus, Frontovi, Radna ploča, Ručice, Detalji izrade**, pretragu i galeriju postojećih artikala. Izbor odmah ažurira cenu i 2D prikaz i čuva se u projektu. Frontovi mogu pratiti korpus, koristiti drugi dekor ili postojeći artikal lakiranog MDF-a uz RAL oznaku i boju prikaza. Cena lakiranja uključuje obradu iz cenovnika. Debljina radne ploče dolazi iz izabranog artikla; promena ažurira nezaključane ploče. Ručice se biraju odvojeno za donje i viseće elemente, uz mogućnost nasleđivanja i položaj ručice na vratima. Zaključani individualni izbori ostaju sačuvani. Postojeća pravila GOLA/Push i konstrukcioni izbori ostaju dostupni preko stranice Cena.

U **Podešavanja → Cenovnik → izmena artikla → Izgled artikla** mogu se dodati boja, tekstura, fotografija dekora/ručice i debljina radne ploče. Fotografije PNG/JPEG/WebP do 2 MB čuvaju se lokalno i prenose JSON kopijom. Izbor vizuelnih podataka ne menja prethodno sačuvanu nabavnu cenu artikla u projektu. Galerija koristi stvarni lokalni cenovnik; ne dodaje izmišljene kataloge proizvođača. Vizuelni podaci su opciona polja kompatibilna sa starim projektima.

Provereni su uklapanje sa kotama i bez njih na 360 px, filteri tlocrta, izmena istim editorom, zaključani izbori, nasleđivanje fronta, RAL, odvojene ručice, debljina ploče, ponovno otvaranje i offline rad. Snimci: `test-results/uklopi-360-kote.png`, `test-results/pogled-odozgo-360.png`, `test-results/izgled-frontovi-390.png` i `test-results/izgled-rucice-390.png`.

### Kartice i fullscreen

Ispod crteža je horizontalna lista kartica visine 120 px, sa SVG ilustracijom iz istog renderera, oznakom i širinom u cm. Prikazuje samo aktivni zid, uz filtere Donji/Viseći/Visoki/Ostali kada su potrebni. Izbor kartice označava i dovodi element u kadar, pa otvara editor. Ilustracije prate vrata, fioke, staklo, aparate i sistem otvaranja. Količine ostaju grupisane uz oznaku ×N.

Ikona **Prikaz preko celog ekrana** koristi Fullscreen API kada je dozvoljen, uz rezervni prikaz preko celog viewporta ako API nije dostupan ili je odbijen. Skriveni su zaglavlje, navigacija i kartice. Ostaju X, Uklopi, Kote i izbor zida. Kadar se prilagođava stvarnoj širini i visini ekrana, `100dvh`, safe-area vrednostima i promeni orijentacije. Dva prsta zumiraju oko njihove sredine. Kratak dodir uređuje, a dugi prevlači istom logikom kao na osnovnom ekranu.

Na landscape ekranima širine najmanje 700 px editor zauzima 40% ekrana, ima sopstveni skrol i ostavlja ostatak za crtež. Na manjim ekranima otvara se kompaktan modal. Paneli se prikazuju unutar istog fullscreen kontejnera, pa rade i kada je aktivan nativni fullscreen. Posle Sačuvaj korisnik ostaje u fullscreen režimu; X vraća prethodni skrol. Validne promene automatski se upisuju u radnu kopiju i projekat istom IndexedDB transakcijom. Neispravno stanje čuva se u radnoj kopiji, a poslednji validni sačuvani projekat ostaje dostupan.

**Ograničenje orijentacije:** aplikacija pokušava `screen.orientation.lock('landscape')` i oslobađa uspešno zaključavanje pri izlasku. Uspeh zavisi od uređaja, pregledača i PWA/fullscreen dozvola. Ako telefon ostane u portrait položaju, prikazuje se „Okrenite telefon horizontalno“. Nema CSS rotiranja interfejsa niti lažnog potvrđivanja zaključavanja. Nativni fullscreen, odbijeni/nedostupni API-ji, rotacija, editor i dodirni gestovi provereni su u Edge/Chromium emulaciji; fizički Android uređaj nije bio priključen.

## Android na istoj Wi-Fi mreži

1. Računar i telefon povežite na istu privatnu Wi-Fi mrežu.
2. Ostavite razvojni server uključen. Na ovom računaru je pronađena adresa **192.168.1.17**.
3. Na telefonu otvorite **http://192.168.1.17:5188**. Adresa se može promeniti; Vite ispisuje aktuelnu Network adresu.
4. Ako Windows Firewall zatraži pristup, dozvolite Node.js na privatnoj mreži. Mreže sa izolacijom klijenata mogu blokirati pristup između telefona i računara.

**HTTP preko lokalne mreže služi za demonstraciju. Android zahteva pouzdan HTTPS ili localhost za service worker i instalaciju PWA aplikacije.** Ne tvrdimo da se PWA može instalirati sa obične HTTP LAN adrese.

Za lokalnu instalaciju bez cloud-a postoje dve mogućnosti:

- Servirajte `dist/` preko lokalnog HTTPS servera sa sertifikatom čijem izdavaocu Android veruje. Otvorite tu adresu u Chrome-u, sačekajte prvo učitavanje, zatim meni → Instaliraj aplikaciju / Dodaj na početni ekran. Sertifikat i lokalni HTTPS nisu automatski podešeni ovim projektom.
- Ako već imate Android platform-tools: uključite USB debugging, povežite telefon, pokrenite `adb reverse tcp:4188 tcp:4188`, ostavite `npm run preview -- --port 4188 --strictPort` uključen i na telefonu otvorite `http://localhost:4188`. Localhost omogućava service worker bez javnog servera. Posle prvog učitavanja/instalacije proverite rad sa isključenom mrežom. ADB nije instaliran niti podešavan u ovom projektu.

Nakon aktivacije service worker-a, lokalni obračuni, ponude, cenovnik, uvoz datoteka i PDF rade bez mreže. Različiti origin-i (localhost, LAN adresa, drugi port ili HTTPS) imaju odvojene baze. Za prelazak koristite JSON rezervnu kopiju.

## Implementirano

- React, Vite, TypeScript, Tailwind CSS i Lucide ikone; veliki numerički unosi, donji paneli, četiri glavne sekcije.
- Početna sa velikim dugmetom za novu kuhinju, nastavkom projekta, poslednjim projektima i pristupom ponudama. Nema ukupnih cena ni DEMO oznaka. Pripremljeni podaci ostaju sačuvani; napomena o neproverenom obračunu je uz ponudu/krojnu listu i u pomoći.
- Podaci o mušteriji i projektu, preskakanje mušterije, tip kuhinje kao evidencija.
- Biblioteka 20 tipova elemenata. Precizan demo obračun za 19 podržanih tipova; ugaoni tip je vidljiv, ali blokiran.
- Dodavanje, izmena, dupliranje, brisanje, količine, vrata/fioke/police, dodatni trošak rada i napomena.
- Odvojeni moduli za konstrukciju panela, površine, kantovanje, količine šarki, klizača, podiznih mehanizama, nogica, ručki, push i GOLA sistema.
- Globalni izbor materijala i konkretnih modela. Individualni izbor uz **Zadrži moj izbor** zaključava sva podešavanja tog elementa. Nezaključani elementi prate globalni izbor.
- Odvojen ekran cene, detalji kategorija na dodir, kompaktna optimizacija sa trenutnom prodajnom razlikom, povratak prethodne izmene, snimanje i poređenje dve varijante.
- Podešavanja svake ponude: debljine, zazori, razmaci, otpad, kantovanje, marža/doplata, sečenje, rad, montaža, transport i ručni kurs. Glavna podešavanja važe za buduće ponude.
- Lokalni cenovnik: dodavanje, izmena, deaktiviranje, više dobavljača, podrazumevani dobavljač, proizvod/proizvođač/jedinica/cena/valuta/klasa.
- Uvoz `.xlsx` preko ExcelJS i `.csv` preko Papa Parse, pregled prvih redova, ručno mapiranje, validacija, blokiranje grešaka, prepoznavanje duplikata i potvrda pre upisa.
- Dugme za preuzimanje demonstracionog Excel dokumenta; fajl se generiše lokalno.
- Cena po tabli zahteva dimenzije table. Odvojeno se prikazuju teorijska površina i površinski minimum kupovine celih tabli. Režim nabavke je podesiv.
- IndexedDB / Dexie: cenovnik, dobavljači, klijenti, ponude, varijante u ponudi, podešavanja i verzionisani konstruktivni šabloni. Početni podaci se upisuju samo prvi put, u transakciji.
- Svaka ponuda i varijanta čuva kompletan snimak cenovnika i parametara. Novi cenovnik ne menja stare iznose. Preračunavanje zahteva posebno dugme i potvrdu sa prikazom razlike.
- Automatsko oporavljanje poslednje radne kopije posle ponovnog učitavanja. Početna omogućava nastavak. Trajno čuvanje u listi ponuda vrši se ikonom **Sačuvaj projekat** u kuhinji ili **Sačuvaj ponudu** u ceni.
- Interni pregled troškova i poseban korisnički pregled. Lokalni PDF sa ugrađenim fontom za srpsku latinicu, bez nabavnih cena i marže.
- JSON izvoz/uvoz kompletne baze, sa proverom strukture i potvrdom zamene postojećih podataka.
- PWA manifest, PNG ikone, lokalni resursi i service worker. Nema cloud-a, naloga, telemetrije, eksternih fontova ni obaveznih API poziva.

## Konstrukciona pravila i formule

Izvor pravila je `src/core/catalog.ts`; svaka bibliotečka stavka ima svoj opis. Izvršni modeli su u `src/core/construction.ts`, a agregacija i troškovi u `src/core/engine.ts`. Verzija modela je `1.0.0` i čuva se uz ponudu.

- Osnovni donji element: dve pune stranice, dno između stranica, dve gornje vezne letve od 100 mm, leđa od HDF-a, police i frontovi. Sudopera nema leđa ni policu; rerna nema frontove ni šarke i ima noseću policu.
- Viseći elementi imaju puna dna i krovove. Otvorena polica nema frontove. Podizni element koristi komplet podiznog mehanizma umesto šarki.
- Visoki ormar ima četiri police i dva fronta jedan iznad drugog; frižider nema leđa i ima 60/40 podelu frontova; visoka rerna ima centralni otvor 600 mm.
- Fioke imaju dve stranice, čelo i zadnju stranicu i HDF dno. Broj kompleta klizača jednak je broju fioka × količina. Demo klizači svih klasa koriste isti pojednostavljeni drveni sanduk; dimenzije i nosivost moraju se proveriti prema stvarnom proizvodu.
- Broj šarki po frontu: do 900 mm → 2, do 1600 → 3, do 2000 → 4, preko 2000 → 5. Ovo je eksplicitno demo pravilo, a ne zamena za tabelu proizvođača o težini i širini fronta.
- Neto površina panela: širina × visina × broj / 1.000.000. Nabavna površina uključuje podesivi procenat otpada. Kant se sabira po imenovanim ivicama panela, u metrima. Prednje ivice korpusa i obim frontova su podrazumevani; postoji i režim svih ivica stranica/dna/krova. Za male vezne letve i police ostaje prednja ivica, prema opisanom modelu.
- Lakirani MDF ima osnovnu cenu plus zasebnu cenu obrade po m².
- Marža: `prodajna cena = trošak / (1 − marža/100)`. Doplata: `trošak × (1 + doplata/100)`. Profit je razlika prodajne cene i troška. To su dva zasebna režima; ne sabiraju se.
- Račun se agregira iz nerazlomljenih međurezultata i prikazuje na dve decimale. U optimizaciji prikazana razlika poredi cenu pri ulasku u optimizaciju sa trenutnim izborom.

### Ograničeni GOLA model

Horizontalni model podržava standardne donje elemente, element za sudoperu i fiokare: zaseban profil po elementu i redu fioke, dužina širina/1000; dva završetka po profilu; konstrukcione letve 60 mm; gornji zazor 30 mm. Sudopera ima jedan profil preko širine korpusa, bez ručki, uz zadržane izostavljene police/leđa za instalacije. Uglovi i kontinualni spojevi nisu podržani. **Otvaranje donjih**, **Otvaranje visećih** i **Otvaranje visokih** imaju nezavisne izbore. Individualno zaključani izbori ostaju prioritetni.

Običan visoki ormar podržava **Vertikalnu GOLA** kada konkretan artikal kategorije GOLA, sa jedinicom `m`, ima `verticalGolaRule`. Pravilo definiše izvor/model, broj profila, odstupanje od vrha/dna korpusa, suženje fronta po profilu, najveće dimenzije korpusa, ID završetka, broj završetaka po profilu i komponente. Dužina jednog profila je `(visina korpusa − odstupanje od vrha − odstupanje od dna)/1000`, a količina elemenata množi sve delove. Front se sužava prema pravilu, bez promene korpusa; ručke se uklanjaju, a 2D prikazuje vertikalni profil. Nosači/dodaci mogu se računati po profilu, vratima, šarki ili elementu.

Ne postoji univerzalno demo pravilo ni nova izmišljena cena za vertikalnu GOLA. Artikal i dokumentacija konkretnog modela podešavaju se u cenovniku ili kroz **Podesi profil** u projektu. Aparatni i kombinovani elementi (uključujući običan ormar sa prikazanim ugrađenim aparatom) ne nasleđuju potvrdu običnog ormara: ostaju nepotpuni i mogu dobiti individualne ručke. Nepodržana konstrukcija ili nedostajući delovi blokiraju validnu ponudu/PDF.

### Viseći frontovi i push pravila

Standardni viseći sa jednom/dve grupe vrata podržavaju **Ručke / Push / Prepušteni front**. Globalna promena ne menja donje elemente. Podizni i otvoreni elementi ne preuzimaju neprovereno pravilo; podizni zadržavaju ručke, a otvoreni ostaju bez frontova. Individualna ručka, okov i prepust čuvaju se uz „Zadrži moj izbor“.

Prepust je stvarni izlazak donje ivice fronta ispod korpusa: `visina fronta = visina korpusa − gornji zazor + prepust`. Uz korpus 720 mm, zazor 2 mm i prepust 20 mm front je 738 mm. Raspon je 1–100 mm. Korpus ostaje isti, nema ručki ni push mehanizama; površina i obim fronta preračunavaju se jednom. Broj šarki prati novu visinu fronta. SVG i njegove kartice prikazuju stvarni prepust, a projekat proverava prostor prema donjim/visokim elementima, ploči i evidentiranim preprekama. Ovo je provera elevacije, bez rešavanja sudara u dubini.

Push front ostaje standardnih dimenzija. Artikal ima eksplicitni `pushRule`: količinu po vratima, podržane konstrukcije, potvrđene ID-jeve šarki/podiznih mehanizama, granice širine/visine fronta i najmanji zazor. Opcioni `hingesPerDoor` zamenjuje demo pravilo broja šarki; za Silent sistem obavezni su taj broj i izvor dokumentacije. `components` povezuje konkretne artikle nosača, dodataka i dodatnog rada sa količinom po vratima, šarki ili elementu. Push artikal može biti `kom` ili `komplet`; stare šarke/ručke ne dodaju se uz novi komplet. Dodatni rad pripada trošku rada, ostale komponente okovima. Cena, valuta i kurs ostaju iz snimka cenovnika.

Pri nekompatibilnom izboru otvara se **Izaberite Push sistem**. Klasični i Silent kompleti pojavljuju se samo ako svi relevantni elementi prolaze konstrukciona pravila i postoje konkretni artikli. Predlog prikazuje mehanizam, šarke, dodatke i njihove cene; tek **Potvrdi izbor** menja okov. Odustajanje čuva prethodni izbor, uključujući premium šarke. **Podesi komplet** omogućava unos pravila i odabir konkretnih kompatibilnih šarki. Izmena pravila unutar projekta čuva se u njegovom snimku cenovnika; cenovnik na zasebnoj stranici uređuje se nezavisno. Kratke greške uz oznaku/naziv elementa imaju dugme **Reši**. Nepoznate kombinacije ostaju **Nepotpun obračun**. Ne zaključuje se kompatibilnost iz proizvođača, naziva ili cenovne klase.

Podizni front traži zasebno eksplicitno pravilo sa tačnim ID-jem podiznog mehanizma; individualni izbor nudi samo takve komplete. Obični visoki ormari zahtevaju posebno uključenu konstrukciju u pravilu. Aparatni elementi ne nasleđuju standardni Push. Globalni viseći zadržavaju ručke na podiznim elementima dok poseban sistem nije izabran. Globalne promene ne utiču na zaključane elemente ili otvaranje donjih.

Postojeći izmišljeni demo push artikal podržava standardne viseće i običan visoki ormar: 1 komad po vratima, osnovne demo šarke, granice pojedinačnog fronta 800 × 1600 mm i zazor najmanje 2 mm. Broj šarki prati visinu svakog fronta; korpus, frontovi i materijal ostaju isti. Izbor kompleta za visoki ormar ne menja viseće ili donje. To je definisano demo pravilo, bez tvrdnje o stvarnom proizvodu. Za pravi model unesite potvrđene podatke proizvođača. Različite push izvedbe imaju različite uslove za šarke i zatvaranje; referenca: [Blum TIP-ON za vrata](https://www.blum.com/us/en/products/motion-technologies/tip-on-doors/overview/).

Referenca za buduća potvrđena Silent pravila je [Hettich katalog Push to open](https://www.hettich.com/fileadmin/Media_Center/Catalogue/Push_to_open_for_hinges.pdf): konkretni Silent modeli, šarke, dimenzije i težina vrata određuju kompatibilnost. Aplikacija ne ubacuje Hettich/Blum cene niti automatski označava njihove proizvode kompatibilnim. Pravila i njihove granice mora potvrditi korisnik prema dokumentaciji izabranog modela.

IndexedDB **v4 → v5** dodaje nezavisne izbore i poznato demo pravilo uz očuvanje cena, korpusa, redosleda, ID-jeva i individualnih snimaka. Nepoznati modeli ne dobijaju pretpostavljenu kompatibilnost. Izbori se čuvaju u projektu, radnoj kopiji, varijantama i JSON kopiji.

Migracija **v5 → v6** dodaje običan visoki ormar samo neizmenjenom prethodnom demo Push pravilu, uključujući cenovnik, projekte, radnu kopiju i varijante. Cene i izbori ostaju isti; korisnička pravila i artikli drugih proizvođača ne menjaju se. Provere sada obuhvataju **154 pojedinačna testa i 60 E2E scenarija**, uključujući Push visokog ormara + GOLA sudopere, precizne količine, 2D i ponovno otvaranje projekta.

### Uvoz cenovnika

Obavezne kolone: **Šifra, Naziv, Kategorija, Dobavljač, Jedinica mere, Cena, Valuta**. Napomena je opciona. Za tablu dodajte **Širina table, Visina table** u mm. Podržan je prvi radni list `.xlsx` fajla; nepoznata zaglavlja se mapiraju ručno. Formule, skenirani dokumenti, `.xls`, višeslojni zaglavni redovi i proizvoljni dobavljački šabloni ne tumače se automatski. Ograničenje: 10 MB / 10.000 redova.

Jedinice: `m²`/`m2`, `m`/`metar`, `kom`/`komad`, `komplet`, `tabla`. Ploče zahtevaju m² ili tablu, trake/profili metre, klizači i podizni mehanizmi komplet, šarke/ručke/nogice/završeci komad. RSD i EUR koriste ručni kurs. Koristite nedvosmislen zapis cene, npr. `1850,50` ili Excel numeričku ćeliju; samo tačka u `1.850` tumači se kao decimalni znak.

Duplikat unutar fajla je greška. Postojeća **šifra + dobavljač** ažurira isti lokalni ID; isti materijal drugog dobavljača je zaseban artikal. Promena jedinice ili kategorije postojećeg artikla zahteva novu šifru. Novi uvezeni okovi dobijaju klasu prema jasnoj reči u nazivu (Premium/Pro, Ekonomični/Osnovne/Basic/Roller), a u odsustvu nje Standard; tip fronta se određuje prema MDF/lakirani. Sve možete izmeniti u artiklu. Proizvođač i cena obrade lakiranja dodatno se podešavaju kroz editor artikla. Pri izboru novih modela prednost ima podrazumevani dobavljač; već izabrani model se ne menja automatski.

## Ograničenja

- Ovo nije sertifikovan proizvodni softver niti garantovana krojna lista. 2D elevacija je šematski pogled spreda; nema punog CAD/3D editora, optimizacije rasporeda po tablama i smeru dekora, CNC/Mach3/Mareta integracije, cloud-a, korisničkih naloga, naplate ni AI-a.
- Ugaoni donji element nije implementiran za preciznu kalkulaciju. Izrezi, ventilacija, vezni i zidni montažni okov, ankere, radijuse, spojeve, opterećenja i specifičnosti proizvođača treba posebno proveriti i po potrebi uneti dodatni trošak. Ponuđena tačnost odnosi se na definisani demo model.
- „Premium Box“ je izmišljeni cenovni primer koji u ovom modelu koristi isti drveni sanduk kao ostale klase. Ne predstavlja kompletnu specifikaciju stvarnog metalnog sistema fioka. Push-to-open traži proveru kompatibilnosti sa okovima.
- Cela tabla se obračunava kao `ceil(površina sa otpadom / površina table)`. Proverava se da svaki panel pojedinačno staje na tablu, ali se ne rešava raspored više panela. Prikazan broj tabli je minimum po površini, a ne garantovan broj tabli za nabavku.
- PDF ne prikazuje posebnu poresku stavku niti predstavlja poreski dokument. Nabavna cena artikla može sadržati uneti PDV i rabat; konačna demo prodajna cena nema zaseban poreski model.
- Deaktivacija artikla zadržava stare snimke i ne prebacuje automatski postojeći izbor na drugi proizvod. Trenutni izbor ostaje dostupan u ponudi, a novi izbori nude aktivne artikle. Samo jasnim izborom modela menja se dobavljač.
- Varijanta čuva i konstrukciju. Primena stare varijante vraća njenu sačuvanu konstrukciju ako je u međuvremenu eksplicitno menjana. Jednako ime varijante ažurira prethodnu varijantu tog imena. Uobičajene promene materijala ne menjaju listu elemenata.
- Podaci zavise od trajnosti skladišta pregledača. Redovno izvozite JSON kopiju; brisanje podataka sajta ili aplikacije može obrisati lokalnu bazu.
- PWA instalacija na Androidu preko HTTPS-a nije proverena na fizičkom telefonu. Automatizovano je proverena offline produkciona aplikacija u Chromium/Edge mobilnoj emulaciji.

## Provera

Provere obuhvataju **136 pojedinačnih testova i 52 E2E scenarija**: geometriju i proporcije 2D prikaza, vrste frontova/aparata, GOLA/push, otvore i sudare, migracije v2/v3/v5 baze, radnu kopiju, varijante, JSON i identičan obračun posle vizuelnih izmena. Novi testovi pokrivaju vertikalne profile/završetke/nosače, tačnu zamenu šarki, Silent komponente i dodatni rad, posebne podizne modele, nepodržane aparatne kombinacije, potvrdu/odustajanje, podešavanje kompleta/profila, zaključane izbore i ponovno otvaranje. Snimci: `test-results/push-komplet-*.png`, `test-results/vertikalna-gola-390.png` i `test-results/sudopera-gola-visoki-push-390.png`. Skaliranje je provereno za zidove 2.000 / 3.200 / 4.500 mm, visoke elemente i različite visine prostorija, bez promene veličine kuhinje zbog udaljenih prepreka. Snimci su u `test-results/skaliranje-*.png`. Posebno je potvrđen primer 600/600/600 → 600/400/600: treći element se pomera sa 1.200 na 1.000 mm u zajedničkom prikazu i sačuvanim podacima, bez praznine. Provereno je i prevlačenje na prekratak zid, sa upozorenjem pre i posle ispuštanja i nepromenjenom širinom.

Dodirni testovi koriste Chromium CDP `Input.dispatchTouchEvent`, a ne samo simulirane DOM događaje: provereni su dugi pritisak, prevlačenje, promena zida, premeštanje razmaka između redova i normalno vertikalno/horizontalno skrolovanje. Fizički Android uređaj nije bio priključen. Mobilne rezolucije ostaju **360×800, 390×844 i 430×932**. Sačuvane su provere obračuna, uvoza, PDF-a i offline rada. Snimci osnovnog 2D prikaza i scenarija su u `test-results/2d-*.png`, a ranijeg prevlačenja i prekoračenja u `test-results/slaganje-*.png`.

```powershell
npm test
npm run build
npm run test:e2e
```

Za E2E prethodno pokrenite dev na 5188 i preview na 4188. Podrazumevano se koristi instalirani Windows Edge; za drugi pregledač podesite `PLAYWRIGHT_EXECUTABLE_PATH`. E2E koristi odvojene privremene profile, ne korisnikov redovan profil.

Testovi pokrivaju konstrukciju, površine i kant, pravila šarki, klizače, kompatibilnost, zaključavanje, materijale, matematiku marže/doplate, snimke cena, eksplicitno preračunavanje, cele table, kurs, uvoz, trajno čuvanje i JSON kopiju. E2E pokriva glavni demo, cene, varijante, cenovnik, PDF, CSV/Excel, uređivanje, širine 360/390/430, desktop i offline reload/PDF. Snimci ekrana i primer PDF-a nalaze se u `test-results/` nakon testiranja.

Kod formatirajte pomoću `npx prettier --write src tests *.ts *.json *.md`. `npm audit` na završetku implementacije: 0 prijavljenih ranjivosti.

Reference korišćene pri implementaciji: [Vite PWA](https://vite-pwa-org.netlify.app/guide/) i [Dexie transakcije / bulkPut](<https://dexie.org/docs/Table/Table.bulkPut()>).
