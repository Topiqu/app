# Core Web Vitals — Topiqu

Datum: 20. 10. 2026. Zdrojový stav: `dev`, `3c9affd9`. Analýza bez změn aplikačního kódu nebo závislostí.

Tento dokument zachovává původní baseline. Následné změny a nové měření jsou v [ověřených optimalizacích](CORE_WEB_VITALS_OPTIMIZATIONS.md).

## Závěr

**Desktop je výrazně lepší než pomalý mobil. Mobilní LCP vyžaduje optimalizaci a homepage má reprodukovatelný post-load CLS při hledání.** Dobré skóre desktopového Lighthouse samo o sobě nestačí: interakční test našel problém, který prosté načtení stránky nezachytilo.

Nejde o výsledek živého webu ani o potvrzení Google CWV assessment. Veřejná nasazená URL nebyla pro tento audit dodána a nejsou dostupné CrUX/Search Console/RUM údaje skutečných návštěvníků. Níže jsou mediány tří laboratorních návštěv, nikoli populační p75. Oficiální dobré hodnoty jsou LCP ≤ 2,5 s, INP ≤ 200 ms a CLS ≤ 0,1; skutečné splnění se hodnotí na 75. percentilu návštěv zvlášť pro mobil a desktop. [Definice a prahy](https://web.dev/articles/vitals).

## Metoda a omezení

- Produkční Nuxt build, nikoli dev Vite. Sestavený kód odpovídá commitnutému aplikačnímu stavu; následné commity rozdělily existující změny, neměnily jejich obsah.
- Izolovaná lokální testovací PostgreSQL databáze se syntetickými články. Homepage `/cs`, článek `/cs/clanky/jak-postavit-udrzitelnou-redakci`; nepřihlášený návštěvník BASIC blogu. Redis není v tomto testovacím runtime zapojen.
- Lighthouse **13.5.0**, Chromium **156**, 27 navigačních běhů. Každá kombinace stránky a hlavního profilu opakována třikrát. Další běhy porovnávaly transport.
- Hlavní srovnání: lokální HTTPS + HTTP/2 + Brotli, potvrzeno síťovým záznamem. Jde o dočasnou auditní proxy, nikoli změnu infrastruktury. Self-signed certifikát byl ignorován jen auditním prohlížečem.
- Lighthouse mobile: 412 × 823, CPU slowdown 4×, simulovaná síť 150 ms RTT / 1,638 Mbps; desktop: 1350 × 940, CPU 1×, 40 ms RTT / 10,24 Mbps. Studená browser cache, bez předchozího souhlasu s cookies; server a IPX už mohly být zahřáté. Nejde o měření cold startu procesu.
- INP a post-load CLS: oficiální **web-vitals 6.2.3** přes Playwright, 12 samostatných návštěv. Skutečné CDP throttling: mobil CPU 4×, 150 ms latency / 1,638 Mbps; desktop CPU 1×, 40 ms / 10,24 Mbps. Výsledky této řady nejsou stejné jako simulované Lighthouse hodnoty.
- Scénář: odmítnutí volitelných cookies, otevření/zavření jazyka a účtu; na homepage téma a psaní do hledání, na článku zdroje; následně scroll. Service worker byl v interakční řadě blokován, cache prázdná. Měřené INP platí pro tyto konkrétní interakce, ne pro celou produkční populaci.
- Ponechány současné reklamní skripty, které aplikace sama načetla. Testovací obsah zahrnuje úmyslně chybějící obrázek pro ověření fallbacku; jeho 404 není důkaz chybějícího produkčního souboru.
- Lokální DB, transport, syntetické obrázky a vypnutá vzdálená telemetrie nenahrazují produkční infrastrukturu, skutečné fotografie, tenant branding, reklamní aukce ani dlouhé uživatelské relace.

## Výsledky skutečných skriptovaných interakcí

Všechny tři metriky v této tabulce pocházejí ze stejné interakční řady; CLS zahrnuje i změny po načtení.

| Stránka / profil   | LCP medián | INP medián | CLS medián | Důležité rozpětí                                                        |
| ------------------ | ---------: | ---------: | ---------: | ----------------------------------------------------------------------- |
| Homepage / mobil   | **6,68 s** | **280 ms** |  **0,279** | LCP 6,60–6,80 s; INP 264–304 ms; stejný velký CLS ve všech třech bězích |
| Článek / mobil     | **7,65 s** | **288 ms** |   0,000086 | LCP 7,63–7,94 s; INP 272–296 ms                                         |
| Homepage / desktop |     1,53 s |      72 ms |   0,000187 | Jeden ze tří běhů měl CLS **0,119**; maximum INP 120 ms                 |
| Článek / desktop   |     2,43 s |      80 ms |   0,000304 | LCP 1,78–**3,54 s**; INP 80–104 ms                                      |

Desktop tedy nelze bez výhrad označit za stabilně vyhovující: jednotlivá pomalejší návštěva nebo interakční posun se objevil i zde. Na mobilu jsou nevyhovující hodnoty opakovatelné.

## Lighthouse — samotná navigace

HTTP/2 + Brotli, mediány tří běhů. **TBT není INP** a Lighthouse performance score není CWV assessment. [Rozdíl laboratorních a field metrik](https://web.dev/articles/vitals).

| Stránka / profil   | Performance |    LCP |      CLS |    TBT |    FCP | Document response |
| ------------------ | ----------: | -----: | -------: | -----: | -----: | ----------------: |
| Homepage / mobil   |          65 | 6,15 s |        0 | 362 ms | 2,70 s |            104 ms |
| Článek / mobil     |          57 | 7,20 s | 0,000605 | 457 ms | 2,76 s |            117 ms |
| Homepage / desktop |          97 | 1,21 s | 0,002849 |  15 ms | 0,83 s |             97 ms |
| Článek / desktop   |          95 | 1,47 s | 0,000307 |   0 ms | 0,83 s |             98 ms |

Hodnoty document response jsou lokální časy odpovědi dokumentu z Lighthouse, nikoli měření produkčního p75 TTFB.

### Proč neměřit dev server nebo neinterpretovat holý lokální HTTP server jako produkci

Stejná mobilní homepage, beze změny aplikace:

| Transport             | LCP medián Lighthouse | Přenos medián | Performance medián |
| --------------------- | --------------------: | ------------: | -----------------: |
| HTTP/1.1 bez komprese |               20,05 s |       3,09 MB |                 42 |
| HTTP/1.1 + Brotli     |                8,72 s |       1,29 MB |                 43 |
| HTTP/2 + Brotli       |                6,15 s |       1,25 MB |                 65 |

Tohle je kontrolovaný laboratorní rozdíl transportu. Neprokazuje, zda nasazený Dokploy/proxy už kompresi a HTTP/2 má. Je nutné ověřit skutečné response headers a protokol na živé URL. Neuvádím výsledek HTTP/1.1 bez komprese jako produkční skóre webu.

## Konkrétní nálezy a pořadí oprav

### P1 — stabilizovat výsledky hledání, nikoli jen zkrátit debounce

`app/pages/index.vue:538`: watcher hned vymaže `articleMap`, následuje 350ms debounce a fetch. Render poté přechází mezi seznamem, šesti skeleton kartami a nízkým `UEmpty` bez zachované výšky výsledkové plochy (`:334`, `:353`).

Reprodukce na mobilu: zvolit téma, napsat `redakce`, počkat na výsledek. Ve všech třech bězích CLS **0,279052**. Dodatečná diagnostika zachytila posun „Poslední diskuze“ a spodního oddělovače **548,4 ms po posledním vstupu**, ještě před následným programovým scrollem na konec stránky. Příčina tedy není tento závěrečný scroll.

Doporučená oprava: během debounce/fetch ponechat poslední výsledky, včas signalizovat načítání a rezervovat rozumnou výšku výsledkové oblasti i pro prázdný stav. Nevytvářet mezi stavy výrazné propady výšky. Ověřit zvlášť hledání bez výsledku, změnu tématu, pomalou odpověď a stránkování. Samotné zkrácení debounce problém na pomalejší síti nezaručeně neřeší. Změny mimo 500ms okno po vstupu se mohou započítat do CLS. [Post-load CLS](https://web.dev/articles/optimize-cls).

### P1 — kritický obrázek článku není prioritní a viditelnost obrázků závisí na JS

`app/components/Article/Header/Hero.vue:48`: `AppMedia` pro hlavní fotografii nemá `priority`. Skutečný LCP element v článkových Lighthouse bězích měl **`loading="lazy"`, `fetchpriority="auto"`** a byl v prvním viewportu. Homepage naopak `priority` správně používá.

`app/components/AppMedia.vue:24`: SSR nastaví `hasLoaded=false`, tedy `opacity-0`; viditelnost se změní až přes klientský load/mount kód. Samostatná kontrola s vypnutým JavaScriptem: prioritní homepage obrázek byl stažený (`complete=true`, `naturalWidth=350`), ale stále měl **opacity 0**. Přenos obrázku tedy není jediná překážka zobrazení.

Doporučená oprava: hlavní obrázek článku načítat prioritně a kritické SSR obrázky nezadržovat do hydratace; zachovat aspect ratio, chyby, origin retry a fallback. Samostatně prověřit agresivní 2s/4s stall timeout na pomalé síti a vstupní opacity animaci hero. Tyto mechanismy nepřepisovat plošně bez kontrol kompatibility. [Doporučení pro LCP](https://web.dev/articles/optimize-lcp).

### P1 — zmenšit veřejný startovní import graph

Homepage HTTP/2 ve zvoleném běhu: **165 požadavků**, z toho **108 link-preload položek**; skripty dohromady přibližně **935 kB přenesených / 2,80 MB dekódovaných** včetně třetích stran. Celkový přenos přibližně **1,25 MB**. Obrázky tvoří jen asi **54 kB**, fonty **40 kB**. Prioritou tedy není další plošná komprese těchto malých testovacích obrázků.

Zdrojové mapy skutečně načteného layout/header chunku obsahují `Sidebar`, `TenantSwitcher`, `Tags/Create`, `Client/Create` a `User/List` i pro guest homepage. Podmínka `v-if` zabrání renderu, ale staticky importovaný modulový graf tím automaticky nezmizí (`app/layouts/default.vue`). Další velké načtené chunky obsahují Nuxt UI theme/date metadata, Iconify, Zod a Sentry.

Doporučená oprava: rozdělit soukromou dashboard větev a hostované veřejné UI, admin modaly a náročné popover obsahy importovat až při jejich skutečné potřebě. Odložení musí zachovat SSR veřejného obsahu a odpovídající skeletony. `Lazy` komponenta renderovaná hned po startu sama o sobě úsporu nezaručí. Nepřepisovat Nuxt UI ani přidávat paralelní knihovnu. Po každém kroku porovnat konkrétní přenesené chunky, TBT a interakční INP.

Interakční diagnostika jednoho mobilního kliknutí na téma dosáhla INP 376 ms; hlavní tříběhová řada měla 264–304 ms. To podporuje potřebu profilovat práci a vykreslení při ovládání, nikoli optimalizovat jen síť. [Optimalizace INP](https://web.dev/articles/optimize-inp).

### P1/P2 — vyjasnit reklamní bootstrap v aktuálním produktu

`app/app.vue:13`, `app/components/AdSenseLoader.vue:16`, `shared/utils/advertising.ts`: BASIC veřejná stránka bootstrapuje AdSense po hydrataci. V měření se reklamní síť načetla i na homepage, jejíž krátký feed neobsahoval vložený reklamní slot, ještě před volbou v Topiqu cookie banneru. Loader sám není touto volbou podmíněn; komentář v advertising utilitě odkazuje na samostatné Google CMP.

Naměřeno přibližně **285 kB třetích stran** z reklamních/traffic-quality domén. To je náklad i bez zobrazené feed reklamy. Nejde zde o právní posouzení souhlasu. Podle `AGENTS.md` je advertising/revenue-share produktově pozastaven; je nutné sladit skutečný bootstrap s tímto rozhodnutím. Pokud reklamy mají být aktivní, měřit náklad skutečného slotu a odkládat mimo kritické vykreslení. Bez A/B testu neslibuji konkrétní úsporu milisekund.

### P2 — CSS, lokalizace, měření a provozní ověření

- Globální CSS má přibližně **307 kB nekomprimované / 44 kB přenesené** a je render-blocking. Zkontrolovat obsah generovaných stylů a kritické UI; neodstraňovat potřebné Nuxt UI varianty jen kvůli skóre.
- Český locale response má přibližně **162 kB nekomprimovaně** a obsahuje i jiné produktové oblasti. Prověřit rozdělení podle veřejné/admin části bez rozbití SSR překladů. Samotný `lazy` locale soubor řeší výběr jazyka, ne automaticky výběr všech namespaces v něm.
- Fonty mají `font-display: swap`, načetly se pouze potřebné Manrope latin/latin-ext WOFF2; nejsou největším přenosovým problémem. Preload přidávat jen pro prokazatelně kritický font a po opětovném měření.
- U skutečného webu ověřit HTTP/2 nebo HTTP/3, Brotli/gzip, cache hashed assetů, CDN obrázky a warm/cold IPX. Lokální proxy je pouze kontrola, ne důkaz jejich produkčního nastavení.
- V repozitáři není vlastní p75 CWV report ani CI performance budget. Sentry modul má browser tracing integraci, ale `sentry.client.config.ts` neobsahuje explicitní tracing sampling; produkční data a jejich dostupnost nebyly ověřeny. Preferovat využití již existující observability s rozumným samplingem a ochranou dat před přidáním dalšího SDK.

## Doporučené ověření po opravách

1. Nejdřív hledání/CLS a prioritní viditelnost LCP obrázku; následně zmenšení veřejných importů a vyřešení reklamního bootstrapu.
2. Opakovat stejnou sadu bez souběžných buildů; ponechat měření po načtení i při interakcích. Přidat regresi na přechod výsledky → prázdný stav při pomalé odpovědi.
3. Změřit skutečnou nasazenou URL, obě hlavní stránky, alespoň BASIC a placený blog, s/bez uloženého souhlasu, vlastními obrázky a tenant fonty.
4. Založit field baseline a vyhodnocovat p75 zvlášť podle zařízení a typu stránky. Tři lokální běhy nestačí k populačnímu vyhodnocení.

## Artefakty a stav repozitáře

- Sdílitelná číselná baseline: `.ecc/benchmarks/core-web-vitals-2026-10-20.json`.
- Surové Lighthouse reporty, web-vitals záznamy, diagnostické skripty a auditní proxy: ignorovaný adresář `.cache/topiqu-cwv/`.
- Žádná změna aplikačního kódu, `package.json`, `bun.lock`, DB schématu, CI ani nasazení. Žádný commit nebo push za tuto analýzu.
- Analýza přidává pouze tento report a baseline. Dev na portu 3001 zůstává oddělený od auditních serverů.
