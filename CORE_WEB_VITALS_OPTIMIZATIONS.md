# Core Web Vitals — ověřené optimalizace

Navazuje na [původní baseline](CORE_WEB_VITALS_AUDIT.md), commit `3c9affd9`. Změny jsou lokální, bez nových závislostí, migrací či zásahu do nasazení.

## Změny

- Homepage během debounce a požadavku ponechá poslední výsledky. Parametry požadavku mají vlastní snapshot, opožděný výsledek jiného filtru se nepoužije, první stránka nahrazuje seznam a další stránky jej rozšiřují. Načítání je signalizované i během debounce. Prostor výsledků se při aktivních filtrech rezervuje nejvýše do výšky viewportu; vymazání filtrů rezervaci resetuje.
- Prioritní `AppMedia` je viditelné už v SSR, bez překrývajícího placeholderu. Titulní obrázek článku a hero logo používají eager/high priority; ostatní obrázky zůstávají lazy. Hlavní hero nečeká na vstupní animaci. Chyby stále přepnou na původní zdroj/fallback; stall timeout má 30 sekund místo 2–4 sekund.
- Titulní obrázek článku má explicitní mobilní breakpointy. SSR před úpravou nabízel mezi zanedbatelnými 1/2px variantami a 1200px variantou velký skok; nyní generuje i 320/640/768px varianty. Používá stávající [Nuxt Image sizes](https://image.nuxt.com/usage/nuxt-img#sizes).
- Sidebar, peněženka a administrátorské dialogy se importují asynchronně. Dialogy se připojí při prvním otevření a zůstávají připojené kvůli přechodům a zachování stavu. Správa štítků načte data i při prvním otevřeném mountu a explicitně vrací fokus. Generation activity se hostům nepřipojuje.
- Samotné async importy nestačily: kontrola SSR a zdrojových map prokázala, že Nuxt soukromé moduly přesto stahoval přes automatické `rel=prefetch` hinty. Hook `build:manifest` vypíná tento plošný SSR prefetch. Preload skutečně vykreslených modulů a navigační prefetch `NuxtLink` zůstávají zachované. Prohlížečový test kontroluje absenci plošných script-prefetch hintů a přítomnost module-preload hintů.
- Reklamní politika nyní odpovídá pozastavení reklamy v `AGENTS.md`: AdSense ani GAM se neaktivují pro žádný tarif ani uložené ID. Zachovaná konfigurace neznamená aktivní entitlement; souhlas nenabízí neaktivní službu. Znovuzapnutí vyžaduje produktové rozhodnutí.

## Výsledek interakčního měření

Oficiální `web-vitals` 6.2.3, Chromium 156, tři návštěvy na kombinaci stránky a profilu; stejná sekvence jako baseline. Tabulka ukazuje mediány celé návštěvy včetně interakcí. Mobil má CPU slowdown 4× a skutečné CDP omezení sítě 150 ms / 1,638 Mbps; desktop CPU 1× a 40 ms / 10,24 Mbps.

| Stránka / profil   |       LCP před → po |    INP před → po |       CLS před → po |
| ------------------ | ------------------: | ---------------: | ------------------: |
| Homepage / mobil   | 6,684 → **3,448 s** | 280 → **200 ms** |    0,279052 → **0** |
| Článek / mobil     | 7,648 → **3,936 s** | 288 → **136 ms** |    0,000086 → **0** |
| Homepage / desktop | 1,532 → **0,648 s** |   72 → **64 ms** | 0,000187 → 0,000601 |
| Článek / desktop   | 2,428 → **0,708 s** |   80 → **56 ms** | 0,000304 → 0,000300 |

Mobilní homepage měla INP **192–224 ms**, článek **120–200 ms**. Medián proto neznamená, že všechny jednotlivé interakce již splňují 200 ms. Mobilní LCP je výrazně lepší, ale **stále nad cílem 2,5 sekundy**. Změny byly měřeny společně; jednotlivým úpravám nelze přiřadit přesnou časovou úsporu bez samostatného A/B měření.

## Lighthouse a přenos

Lighthouse 13.5.0, HTTPS/HTTP2/Brotli, opět tři navigace na profil. Jde o samostatnou simulovanou řadu; TBT není INP a její LCP se nesmí zaměňovat s interakční tabulkou výše.

| Stránka / profil   | Skóre před → po |       LCP před → po |     TBT před → po |
| ------------------ | --------------: | ------------------: | ----------------: |
| Homepage / mobil   |     65 → **75** | 6,150 → **4,576 s** | 361,5 → **92 ms** |
| Článek / mobil     |     57 → **74** | 7,201 → **5,401 s** | 456,5 → **82 ms** |
| Homepage / desktop |     97 → **98** | 1,210 → **0,968 s** |     15 → **0 ms** |
| Článek / desktop   |     95 → **98** | 1,475 → **1,028 s** |      0 → **0 ms** |

Nezlepšila se každá metrika: simulovaný FCP homepage má medián **3,660 s místo 2,700 s**, s rozpětím nových běhů 2,476–4,106 s. V interakční řadě se skutečným CDP throttlingem FCP naopak klesl z 3,944 na 3,448 s. To je důvod ponechat obě řady a dál profilovat startovací cestu CSS/písmo/JavaScript; skóre ani jediný typ měření nenahrazují produkční data.

Srovnatelný vzorek druhého mobilního Lighthouse běhu homepage:

- Celkový přenos **1 253 920 → 885 852 B**, pokles **29,4 %**.
- HTTP požadavky **150 → 123**, z toho first-party **137 → 123**; nový vzorek nemá externí HTTP hosty.
- Přenos skutečně načtených script resources **935 386 → 614 076 B**; dekódovaná velikost **2 801 602 → 1 826 591 B**.
- Kontrola síťových URL proti zdrojovým mapám potvrzuje, že se nestáhly `Sidebar`, `TenantSwitcher`, `Tags/Create`, `Client/Create`, `User/List`, `Client/Version` ani `Article/GenerationActivity`. Je to optimalizace načítání, nikoli autorizační ochrana.

Strojově čitelná [baseline](.ecc/benchmarks/core-web-vitals-2026-10-20.json) a [nový výsledek](.ecc/benchmarks/core-web-vitals-2026-10-20-after.json) obsahují mediány i rozpětí. Surové lokální reporty a diagnostické meziběhy jsou v ignorovaném `.cache/topiqu-cwv/`.

## Ověření a omezení

Ověření: kompletní Vitest sada 2 324 úspěšných testů včetně 51 integračních testů nad izolovanou PostgreSQL databází; 22 externích/AI scénářů je přeskočených. Po finální úpravě dialogu znovu prošlo 31 cílených testů a 16 prohlížečových kontrol na produkčním buildu (mobil, tmavý desktop, peněženka, dialogy, service worker a SSR přihlášení). Lint, typecheck, Prettier, OpenAPI check, produkční Bun/Nitro build a `git diff --check` prošly. Testy se nedotýkají vývojové ani produkční databáze.

Dev server byl obnoven na portu 3001. `http://viky.localhost:3001/cs` i editorový modul `/_nuxt/components/Article/Editor/Workspace.vue` vracejí HTTP 200. V dev SSR logu zůstává varování Vue o slotu RouterLink vyvolaném mimo render v řetězci Nuxt UI/Reka; jeho původ ani dopad se v této změně neurčoval. Nejde o tvrzení, že dev log je bez varování nebo že byl ručně ověřen přihlášený editor na vývojové databázi.

Samostatná Linux Docker image se v této změně znovu nestavěla: Dockerfile, runtime ani nativní závislosti se neměnily. Nespouštěly se placené externí AI/provider scénáře, produkční migrace ani nasazení.

Měření používá lokální produkční build, syntetickou BASIC publikaci a HTTPS/HTTP2/Brotli auditní proxy, stejně jako baseline. Žádné naměřené číslo zde není populační p75 ani potvrzení Google CWV assessment. Bez nasazené URL a dat skutečných návštěvníků nelze potvrdit produkční CWV.

Neměnil se hosting, DNS, CDN, databázové schéma, cenová politika ani vzdálená telemetrie. Globální CSS, route-level lokalizační dělení a dodavatelské balíky potřebují samostatné profilování; plošná změna bez důkazu by nebyla bezpečná optimalizace. Známá omezení produkční bezpečnosti a neopravená upstream advisories zůstávají v [produkčním auditu](PRODUCTION_AUDIT.md).

## Produkční nálezy z 21. října 2026

Na veřejné stránce `trawl.topiqu.com/en` se potvrdily 1px/2px varianty responsivních obrázků, CSP hlášení vyvolané Zod `Function()` sondou a IPX odpovědi s `application/octet-stream` místo MIME obrázku. Poslední problém vznikal v Node adaptéru IPX na Bun/Nitro, nikoli chybějícím nastavením TTL: konfigurace již požadovala rok pro vzdálená média. Cloudflare odpověď bez správných origin hlaviček vracela čtyřhodinovou cache.

Oprava připojuje IPX Fetch handler přímo k H3 přes verzovaný Bun patch; zachovává parser URL, provider konfiguraci a povolené hosty. Compiled E2E ověřuje MIME, TTL, ETag/304, restriktivní CSP obrázku a odmítnutí nepovoleného zdroje. Média dostala explicitní 320px/480px breakpointy a opravené size hints, uploadové náhledy odpovídají svým skutečným rozměrům. Manrope má jeden stabilně identifikovaný preload. Prefetch odkazů začíná při hover/focus interakci a cookie nastavení se načte až při prvním otevření. Sdílený Zod vstup vypíná browser JIT před konstrukcí schémat, bez `unsafe-eval` a bez změny serverové validace.

Pokus o hydrataci účtového a jazykového ovládání až po kliknutí byl odstraněn: zahazoval první klik. Header zůstává standardně hydratovaný a regresní test ověřuje první otevření obou ovládacích prvků.

### Opakované lokální měření

Tři studené běhy Lighthouse 13.5.0 pro každé zařízení, stejná seeded homepage `/cs`, HTTP/2 a Brotli Q4. Jde o laboratorní srovnání, nikoli produkční field data ani přímou reprodukci dodaných Trawl screenshotů. Výchozí první mobilní běh se krátce překrýval se samostatným profilem veřejné stránky; všechny výsledky jsou zachované v `.ecc/benchmarks/core-web-vitals-2026-10-21.json`. Následné běhy byly sériové bez souběžných buildů či testů.

| Medián | Mobil před → po     | Desktop před → po   |
| ------ | ------------------- | ------------------- |
| Skóre  | 75 → 73             | 98 → 98             |
| FCP    | 3 653 → 3 656 ms    | 737 → 744 ms        |
| LCP    | 5 262 → 4 986 ms    | 958 → 984 ms        |
| TBT    | 149,5 → 95,5 ms     | 0 → 0 ms            |
| CLS    | 0,00050 → 0         | 0,00345 → 0         |
| Přenos | 885 864 → 839 917 B | 897 071 → 845 777 B |

Přenos a mobilní TBT se snížily, ale celkové skóre se přesvědčivě nezlepšilo. Mobilní LCP zůstává nad cílem 2,5 s. Ve vzorku prvních mobilních běhů klesl počet požadavků 123 → 113 a přenos JavaScriptu 614 099 → 568 470 B. Výsledky neopravňují k tvrzení, že jsou vyřešené všechny Core Web Vitals.

Ověření: 2 326 Vitest testů prošlo, 22 externích/AI testů přeskočeno; 22 compiled E2E prošlo, desktopový collapsed-rail scénář na mobilu přeskočen. Typecheck, lint, formátování, OpenAPI a hostitelský produkční build prošly. Frozen install zachovává verze závislostí a přidává pouze IPX patch. Lokální Docker pokus se dvěma CPU a 4 GiB RAM skončil na paměťovém limitu; úsporný retry byl zastaven a změna Dockerfile vrácena. Linux Docker build se ověřuje v existujícím CI před povýšením na `main`, nikoli zvýšením zátěže vývojářského počítače. Žádné migrace nejsou součástí této sady změn.
