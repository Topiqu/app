# Topiqu — audit připravenosti pro produkci

Datum: 20. 10. 2026. Základ: `dev`, HEAD `c27ac849`, včetně existujících necommitnutých změn.

## Stav po opravách 20. 10. 2026

Níže uvedených 16 nálezů popisuje původní stav před opravami. Jejich implementace byla opravena v pracovním stromu; původní skóre 62/100 není hodnocením nynějšího kódu. Nové skóre nenahrazuje ověření reálné infrastruktury a nezávislý bezpečnostní test.

| Nález | Implementovaná náprava                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Upload nejdřív ověří oprávnění a účel; server generuje tenant/UUID klíč. Skutečný formát se dekóduje a normalizuje s pixelovým a velikostním limitem.                                         |
| 2     | Sdílený explicitní veřejný select pro feed, featured, related a autora; interní údaje neopouštějí DTO. Změněny verze feed cache. Soukromý profil lze načíst jen vlastní nebo jako superadmin. |
| 3     | Jednotný fail-closed cron guard s porovnáním secretu; chybějící secret úlohu nepustí.                                                                                                         |
| 4     | Doplněn trial-expiry a domain-reverification; rotace nejdéle nekontrolovaných domén; downgrade chráněn před souběžnou platbou.                                                                |
| 5     | Webhooky mění jen připojené předplatné, aktualizace čtou aktuální stav Stripe. Zablokován druhý aktivní checkout, doplněna idempotence a validace návratových URL.                            |
| 6     | Aktivní tenant v resolverech, sessions, membership guardu a veřejných dotazech. Deaktivace neruší globální identity uživatelů.                                                                |
| 7     | Účelově oddělený HMAC reset token, atomické spotřebování a změna hesla s odvoláním sessions, rate limit, 15minutová platnost. Staré reset kódy je nutné vyžádat znovu.                        |
| 8     | Build nikdy nemigruje DB ani nepotřebuje její credentials. Runtime běží jako bun, má healthcheck; migrace je samostatný autorizovaný release krok.                                            |
| 9     | Žádná runtime API cache ve Workbox; při aktivaci se odstraní starý api-cache; API má no-store.                                                                                                |
| 10    | Publikování má transakční advisory lock, dávkování a filtr aktivních tenantů.                                                                                                                 |
| 11    | Překlady mají obnovitelnou 30minutovou lease a 15minutový timeout. Dokončení musí vlastnit původní claim a stále splňovat podmínky; obsah a media usage se ukládají atomicky.                 |
| 12    | Přijetí pozvánky nemění globální roli a jednorázové spotřebování je ve stejné transakci jako členství.                                                                                        |
| 13    | allTags dotaz načítá jen tagy, žádný obsah článků.                                                                                                                                            |
| 14    | Redis INCR/TTL jedním Lua skriptem; lokální fallback má expiraci, limit 20 000 a při zaplnění odmítá nové identity.                                                                           |
| 15    | Externí logování má omezenou frontu, timeout a nezdržuje request; DB audit a konzole zůstávají primární. Audit má monotónní čas pod lockem.                                                   |
| 16    | Omezený pool, connection/statement timeout, DB readiness s deadline a oddělená liveness /api/live; validace produkční konfigurace.                                                            |

Navíc je escapován uživatelský vstup do e-mailového HTML, testy kontrolují obnovené lease, bezpečnost veřejných projekcí a skutečné PostgreSQL souběhy. Linux build odhalil chybný auto-import generického parametru `R`; deklarace generické funkce byla opravena.

### Zbývající externí a provozní ověření

- `bun audit` našel tři upstream advisories bez vydané opravené verze. `bun audit fix` opravil 0/3; nic není potlačeno a závislosti nebyly naslepo přepsány. [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) je ve větvích glob/build tooling, [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) v listhen certifikátech a [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) přes argparse mimo jiné v mammoth. Aplikace tyto API přímo nevolá; úplná absence zneužitelné tranzitivní cesty není tímto prokázána. Jsou otevřeným bodem pro monitoring a následný patch upstreamu.
- Neproběhl produkční restore drill, kontrola Dokploy secrets, proxy/TLS/DNS, Redis HA ani škálování na více replik. Překlady a publikace mají popsané claim/lock ochrany; ostatní periodické úlohy nejsou tímto certifikovány pro libovolný počet replik.
- Stripe, Shopify, AI, S3/SES a externí webhooky nebyly testovány proti živým účtům. Testy používají syntetická data a dedikovanou lokální testovací databázi.
- Nový Docker workflow vyžaduje explicitní migraci před spuštěním kompatibilního releasu. Žádný produkční release ani produkční migrace nebyly provedeny.

### Ověření oprav

- Frozen instalace: prošla, beze změny `package.json` a `bun.lock`.
- Lint, Prettier, OpenAPI kontrakt, typecheck a `git diff --check`: prošly.
- Celá Vitest sada s PostgreSQL (`bun run test --maxWorkers=2`): **2321 prošlo, 22 přeskočeno**, 314 úspěšných souborů a 6 přeskočených. Přeskočené evaly zahrnují opt-in testy živých AI providerů; žádný neúspěšný test nezůstal skrytý.
- Host produkční build včetně generování ZenStack: prošel. Linux/arm64 Docker image s Bun 1.4.2: sestaven bez DB credentials a bez spuštění migrací.
- Lokální běh skutečného produkčního kontejneru: uživatel `bun`, readiness i liveness HTTP 200, cron s `Bearer undefined` bez nastaveného secretu HTTP 401, anonymní privátní profil HTTP 401. Kontejner po testu zastaven a odstraněn; použita výhradně testovací DB.
- Compiled release E2E: **3/3 prošly** (SSR session, dostupnost assetů, vyčištění legacy service-worker cache a odmítnutí offline auth odpovědi).
- Compiled wallet E2E: **5/5 prošlo** včetně přípravy reader/admin/super účtů a mobilního i desktopového scénáře scrollování.
- Compiled homepage/editor E2E: **6 prošlo, 1 záměrně přeskočeno** (mutující editor se spouští jen jednou na desktopu). Homepage ověřena i při **320 px**, včetně accessibility/kontrastu; editor uložen a znovu načten s potvrzením media-rights review. Testy respektují nynější chování bez duplicit doporučených článků a zachování editoru po uložení.
- Samostatné opakování UI testů: **34/34 prošlo**. Předchozí souběh dvou buildů a celé sady způsobil timeout tří testů a následný nedokončený popover; při opakování nebyly limity ani aserce oslabeny.
- Rozšířený E2E běh odhalil, že runtime převzal `APP_ENV=production` a odeslal IndexNow požadavek se syntetickým localhost článkem (odpověď 429). `playwright.config.ts` nyní explicitně nastavuje testovacímu serveru `APP_ENV=test`; následné opakování už externí indexování nespustilo. Nebyl odeslán zákaznický obsah.
- Dev znovu běží na `viky.localhost:3001`: veřejná stránka i dynamický Workspace modul HTTP 200. V dev SSR jsou nefatální Vue RouterLink slot warnings; produkční browser scénáře prošly. Celá Playwright matice ani nezávislý penetrační test nebyly provedeny.
- Lokální Bun je 1.4.3, image/CI zůstávají připnuté na 1.4.2. Změny nebyly commitnuté, pushnuté ani nasazené.

## Původní audit před opravami

**Původní verdikt: 62/100.** Následující nálezy jsou zachovány jako evidence původního problému; jejich čísla odpovídají tabulce oprav výše.

## Rozsah a metoda

Inventarizováno 245 API souborů, 462 serverových souborů, 235 komponent a 23 stránek. Ručně byly sledovány zejména autentizace, tenant scope, veřejné feedy/detail, upload/CDN, Stripe a Shopify webhooky, pozvánky, plánované publikování, překlady, znalostní zdroje, cache, service worker, CI a Docker. Nejde o tvrzení, že byl každý řádek všech těchto souborů individuálně prověřen.

Audit neměnil implementaci, nevolal placené providery, neposílal maily/webhooky a neměnil zákaznická data. Čtyři dočasné reprodukční testy volaly skutečné handlery s plně mockovanými vedlejšími efekty; po ověření byly odstraněny. Jejich výstup je v `/tmp/topiqu-audit-probes.log`.

## P1 — opravit před releasem

### 1. Upload umožňuje vybrat a přepsat cizí veřejný CDN objekt

- Místa: `server/api/upload.ts:25`, `:66`, `:101`; `server/utils/storage.ts:31`.
- `customFilename` určuje konečný klíč `uploads/<jméno>`. Sanitizace odstraňuje cestu, ale nedokazuje vlastnictví objektu a nepřidává serverový identifikátor ani tenant namespace. `PutObject` nemá podmínku zakazující přepis.
- Tenant scope se kontroluje jen pro klientem zvolený typ `article-image`. Jiný typ projde pouze s přihlášeným reader účtem. Analýza obrázku navíc běží před touto kontrolou.
- **Reprodukce prošla:** reader s typem `client-logo` a syntetickým `customFilename` dosáhl mockovaného zápisu do přesně zadaného existujícího klíče. Reálný CDN objekt nebyl změněn.
- Oprava: serverem generované neměnné klíče; tenant/user prefix; původní název jen jako metadata; validovaný výčet účelů a autorizace před analýzou i uložením. Pro běžné obrázky ověřovat/dekódovat skutečný formát, ne pouze důvěřovat klientskému MIME. Přidat limity na nákladné operace.
- Ověření: dva různí tenanti nemohou ovlivnit stejný klíč; reader nemůže přes jiný `type` obejít tenant upload scope; odmítnutí nepustí Rekognition ani S3.

### 2. Veřejné seznamy článků zveřejňují interní pole

- Místa: `server/api/articles/featured/[slug].ts:30`, `:59`, `:91`; `server/api/articles/by-clientsite/[slug].ts:30`, `:103`; `prisma/models/article.zmodel:132`.
- Dotazy používají `include`, takže načtou všechny skalární sloupce článku. Mapování odstraní `content` a `reactions`, ale zbytek rozbalí do veřejné odpovědi. Zůstává například `prompt`, `savedAmount`, `savedTimeMinutes` a další interní metadata.
- **Reprodukce prošla:** anonymní featured odpověď obsahovala syntetická interní pole. Nepoužívaly se skutečné prompty zákazníků.
- Oprava: explicitní výběr veřejných polí karty, podobně jako existující explicitní select v detailu článku. Změnit verzi cache klíčů, aby se nepoužily staré serializované odpovědi.
- Ověření: regresní testy skutečného výsledného DTO pro guest, reader i admin; zakázaná pole nesmí opustit endpoint ani Redis cache.

### 3. Část cron endpointů při chybějícím secretu přijme veřejně odhadnutelnou hodnotu

- Místa: `server/api/crons/publish-check.ts:2`, `linkedin-generate.ts:7`, `linkedin-publish.ts:5`, `linkedin-sync.ts:2`.
- Porovnává se přímo s interpolací `process.env.CRON_SECRET`; chybí odmítnutí nezadaného secretu. Shopify cron endpointy už správnou kontrolu mají.
- **Reprodukce prošla:** bez `CRON_SECRET` prošel syntetický požadavek k mockovanému `runTask`. Žádná úloha reálně neběžela.
- Oprava: odmítnout chybějící/prázdný secret před porovnáním; stejná kontrola pro všechny cron vstupy; produkční validace konfigurace.
- Ověření: absent/empty/wrong secret vždy 401/503 a žádný přístup k DB/providerům.

### 4. Dvě důležité úlohy nejsou zapojené do plánovače

- Místa: `nuxt.config.ts:141`; `server/tasks/trial-expiry.ts`; `server/tasks/domain-reverification.ts`; `server/utils/requireAiPlan.ts`.
- V repozitářovém produkčním rozvrhu chybí `trial-expiry` i `domain-reverification`. Nebyl nalezen ani jejich další automatický spouštěč. Externí ručně nastavený scheduler mimo repozitář nebyl přístupný auditu.
- Důsledek: bez externího spouštění se automaticky neodeberou placená oprávnění po konci trialu a neběží průběžná kontrola DNS. Tlačítko ukončení trialu nenahrazuje vynucení na serveru.
- Oprava: zapojit obě úlohy a jejich heartbeat; pravidelně vybírat nejdéle nekontrolované domény. `domain-reverification` má `take: 200` bez rotace/řazení, takže samotné doplnění rozvrhu nestačí pro více než 200 domén.
- Ověření: test kompletnosti plánovače a časové přechody trialu; kontrola všech domén ve více dávkách.

### 5. Opožděný Stripe webhook může zrušit novější předplatné

- Místa: `server/api/stripe/webhook.ts:18`, `:98`, `:135`.
- Událost se odvodí z tenant ID v metadatech. Při `subscription.deleted` se bez porovnání aktuálního `stripeSubscriptionId` nastaví BASIC a vymaže ID předplatného. Také aktualizační události používají stav příchozího payloadu bez kontroly jeho aktuálnosti.
- **Reprodukce prošla:** událost syntetického starého předplatného vedla k tenant-wide odebrání tarifu bez podmínky na ID předplatného.
- Oprava: ignorovat události jiného než aktuálního předplatného a bezpečně rekoncilovat aktuální stav; zpracovat duplicity i události doručené mimo pořadí. Zakázat nechtěné paralelní subscription checkouty pro stejný tenant.
- Ověření: nové předplatné aktivní → dorazí zrušení starého → nový tarif zůstane. Stejně pro opožděnou aktualizaci a opakovanou událost.
- Pozitivní nález: podpisy webhooků a idempotentní klíče pro nákup/příděl článků už existují. Problém není plošná absence idempotence účtování.

### 6. Deaktivace tenantu není důsledně vynucená při čtení a autorizaci

- Místa: `server/api/clients/[id]/index.delete.ts:19`; `server/api/clients/slug/[slug].ts:12`; `server/utils/tenant.ts:29`; `server/utils/session.ts:60`; `server/utils/tenantMembership.ts:38`.
- Soft delete označí site a domovské uživatele jako smazané. Resolver veřejného tenantu ale nefiltruje `deletedAt`, public site endpoint také ne. Scope guard kontroluje smazání membership, nikoli tenantu. Přepočet aktivního session tenantu si vybírá plán, ale nikoli stav smazání site.
- Není zde globální automatický soft-delete filtr: `Base` pouze definuje `deletedAt`, DB plugin ho nevkládá do dotazů. Ostatní členové tenantu nejsou nutně mezi jeho domovskými uživateli.
- Oprava: jednotně vynucovat aktivní tenant na veřejných i privilegovaných hranicích; při deaktivaci zneplatnit session tenanty a host/feed cache. Nemazat účty jiných tenantů jen proto, že mají společnou identitu.
- Ověření: deaktivovaný blog se veřejně nevykreslí; existující člen ani stará session nemohou dál mutovat jeho data; ostatní tenanty účtu fungují.

### 7. Reset hesla neruší existující sessions a není atomický

- Místa: `server/api/auth/reset.post.ts:11`; `server/utils/auth.ts:173`; `server/api/auth/forgot.post.ts:8`.
- Reset změní heslo, pak provede audit a až následně smaže kód. Existující sessions nejsou zrušené, přestože mají až 30denní platnost. Při selhání mezi zápisy zůstane heslo změněné a kód nevyčerpaný; souběžné požadavky mohou oba projít předběžným čtením.
- Oprava: atomicky spotřebovat správný jednorázový kód a změnit heslo; zrušit staré sessions; oddělit účel resetovacího a ověřovacího tokenu. Použít serverové schéma hesla a per-account/IP limity. `forgot` aktuálně také rozlišuje neexistující účet odpovědí 404 a nemá vlastní cooldown jako resend verification.
- Ověření: stará cookie po resetu nedává přístup; jen jeden souběžný reset uspěje; neúspěšný audit nezpůsobí částečně provedený reset; veřejný výsledek neprozrazuje existenci emailu.

### 8. Docker image build provádí migrace před dokončením buildu

- Místo: `Dockerfile:28–34`; popsané i v `README.md`.
- `RUN bun release` mění databázi ještě před `bun run build`. Neúspěšný build tedy může zanechat produkční DB změněnou, zatímco běží stará aplikace. Zároveň je build závislý na přístupu do živé databáze a dostává DB přihlašovací údaj přes build argument.
- Oprava: reprodukovatelný build bez DB mutací; migrace jako samostatný autorizovaný release krok pro přesný environment, následovaný rolloutem kompatibilního image. U destruktivních změn rozdělit rozšíření a pozdější odstranění; dokumentovat restore/forward-fix postup.
- Ověření: záměrně neúspěšný build nezmění DB; sestavení nevyžaduje produkční DB credentials; rollback staré aplikace zůstává kompatibilní s aplikovanými migracemi.

### 9. Service worker má příliš široké cachování odpovědí

- Místo: `nuxt.config.ts:697`.
- `NetworkFirst` odpovídá všem GET URL na přesném hostu `https://topiqu.com/`, včetně `/api/auth/get-session` a osobních stránek. Cache je persistentní až 24 hodin, bez rozlišení přihlášené identity a bez nalezeného vyčištění při odhlášení. `NetworkFirst` může při výpadku vrátit starou odpověď. Toto pravidlo se nevztahuje automaticky na `app.topiqu.com` ani tenant subdomény.
- Potvrzeno čtením konfigurace a lokální implementace Workbox; scénář přepnutí dvou skutečných účtů v produkčním service workeru nebyl spuštěn. Není to tvrzení o serverovém obejití autentizace, ale o úniku/stárnutí údajů v lokální cache prohlížeče.
- Oprava: osobní/auth/API odpovědi `NetworkOnly`; explicitně cachovat pouze vhodné veřejné zdroje. Při upgradu odstranit starou `api-cache`.
- Ověření: účet A → odhlášení → účet B/offline neobdrží data A; cache neobsahuje auth/private odpovědi. Release smoke musí tento scénář skutečně testovat, nikoli jen registraci workeru.

## P2 — spolehlivost a výkon

### 10. Plánované publikování může při souběhu poslat duplicitní notifikace

- Místo: `server/tasks/publish-check.ts:51–87`.
- Dva běhy mohou načíst stejné drafty. Guarded `updateMany` správně zabrání druhému přechodu stavu, ale další operace/notifikace dál iterují celý původní `publishable` seznam, nikoli skutečně získané články. Z kódu je zřejmé, že `count: 0` tyto efekty nezastaví. Souběh nebyl testován na skutečné DB.
- Oprava: atomicky získat konkrétní řádky a další operace provádět jen pro ně; použít idempotentní klíč publikace pro notifikace/outbox. Ověřit dva souběžné běhy i restart mezi commitem a doručením webhooku.

### 11. Automatické překlady nemají obnovitelnou lease

- Místo: `server/tasks/translate-pending.ts:15`, `:54`, `:132`.
- Atomické přepnutí na `TRANSLATING` chrání před duplicitou, ale po pádu procesu není lease/reclaim cesta. Další běhy vybírají pouze `PENDING` a `STALE`. Po úspěšném publikování se neinvaliduje feed cache a `logAction` je volaný bez `await`/catch.
- Oprava: omezená lease s identifikátorem vlastníka, bezpečné převzetí po timeoutu, invalidace relevantních veřejných cache, zachycení auditu. Využít existující vzory z knowledge/webhook/Shopify front, nepřidávat druhý queue systém.

### 12. Přijetí pozvánky přepisuje globální roli

- Místo: `server/api/invitations/[token].post.ts:37–45`.
- Bezpodmínečný zápis `role: 'admin'` změní i superadmina. Členství už přitom určuje tenant roli přes `toSessionUser`. Stav pozvánky se čte mimo transakci a spotřebování není guarded proti mezitím provedenému revoke/accept.
- Oprava: zachovat systémovou roli; tenant oprávnění měnit v membership. Pozvánku atomicky spotřebovat jen pokud je stále platná/neodvolaná/nepřijatá. Ověřit existující účet, superadmina i souběh revoke/accept.

### 13. Každá stránka feedu načítá všechny články kvůli tagům

- Místo: `server/api/articles/by-clientsite/[slug].ts:62–77`.
- `findMany` pro `allTags` je neomezené a používá `include`, takže z DB zbytečně načte i celá těla všech publikovaných článků. Běží uvnitř každého sestavení feedu, včetně přihlášených uživatelů a dalších stránek. Stránkování samotných karet to neomezuje.
- Oprava: vybírat tagy přes jejich vztah k publikovaným článkům a explicitní `select`, případně samostatná cache metadat se stejnou invalidací. Podobně zmenšit featured dotazy na potřebné sloupce.
- Ověření: počet/velikost načtených řádků pro jednu feed stránku neroste s celkovým množstvím těla obsahu tenantu.

### 14. Fallback rate limiter bez Redis neodstraňuje staré klíče

- Místo: `server/utils/cache.ts:148–170`.
- Expirace se kontroluje jen při dalším přístupu ke stejnému klíči. Útok s mnoha identitami nebo dlouhý provoz při výpadku Redis nechává Map růst bez horní meze. Navíc jde o limit na proces, takže více replik má nezávislé počítadlo. Redis větev provádí `INCR` a `EXPIRE` odděleně.
- Oprava: omezená fallback cache s průběžným úklidem a metrikou degradace; atomický Redis counter s TTL. U bezpečnostních limitů výslovně rozhodnout chování při výpadku sdíleného backendu.

### 15. Externí logging může zdržet uživatelskou operaci

- Místa: `server/utils/logger.ts:20–35`; `server/utils/log.ts:95`; `server/utils/authLogin.ts:65`.
- Očekávané `await logger.*` čeká na externí HTTP s timeoutem a retry. Čtení auditního řetězce je navíc serializované jedním DB advisory lockem pro celou platformu. Pomalé logování tak zvyšuje latenci jinak dokončených operací; nejde jen o nízkou rychlost UI.
- Oprava: zachovat transakční audit v DB, externí transport oddělit od úspěchu požadavku pomocí existujícího outbox/bounded delivery vzoru. Změnu auditního řetězce dělat až podle měření čekání na lock.
- Ověření: výpadek logovací služby neprodlužuje login/save o síťový timeout a nezpůsobuje falešné selhání dokončené změny.

### 16. Ochrana DB a health/readiness potřebují provozní limity

- Místa: `server/utils/database.ts:7`; `server/api/health.get.ts`; `Dockerfile:37`.
- Pool není explicitně omezený podle počtu replik, nemá připojovací timeout a repo neurčuje statement timeout. Health dotaz nemá vlastní deadline a testuje pouze DB. Docker běží bez explicitního neprivilegovaného `USER`; jeho readiness nastavení se musí ověřit na platformě.
- Doporučení: nastavit rozpočet připojení a timeouty podle infrastruktury; rychlý liveness oddělit od bounded readiness; sledovat dostupnost Redis/queue/cron heartbeatů, aniž by se z nich nutně stala podmínka liveness. Runtime image spouštět pod neprivilegovaným uživatelem po ověření potřebných oprávnění.
- Chybí měření skutečné zátěže a nastavení Dokploy, takže toto je provozní hardening, ne důkaz konkrétního produkčního výpadku.

## Kontroly, které musí být zelené před releasem

| Kontrola                                       | Výsledek tohoto auditu                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `bun run lint`                                 | PASS                                                                                      |
| `bun run typecheck`                            | PASS                                                                                      |
| `bun run openapi:check`                        | PASS                                                                                      |
| `TEST_DATABASE_URL= bun run test`              | 2 243 PASS, 2 FAIL, 69 SKIP; 317 test souborů                                             |
| Čtyři izolované reprodukční testy              | 4/4 PASS; potvrzují nežádoucí chování, nikoli jeho opravu                                 |
| `bun run prettier`                             | FAIL — 51 souborů; bez plošného přepisování                                               |
| `bun run build:docker`                         | PASS, 39,3 s; Nuxt/Nitro build na macOS arm64, nikoli skutečný Linux Docker build         |
| `git diff --check`                             | PASS před přidáním tohoto dokumentu; znovu ověřeno při dokončení                          |
| Lokální stav migrací                           | 118 migrací, schema aktuální; kontrola bez zápisu                                         |
| PostgreSQL integrační testy / release E2E      | Nespouštěny: není pro audit použitá samostatná ověřená test DB; žádný seed do vývojové DB |
| Produkční provoz / DNS / zálohy / CI na remote | Neověřováno; žádný deploy, push, úprava DNS ani přístup k produkčním záznamům             |

Selhávající testy jsou oba v `tests/unit/nuxtUiContract.test.ts`:

1. `NuxtErrorBoundary` chybí v ručním seznamu framework komponent. Je prokazatelně v nainstalovaném Nuxtu i generovaném `components.d.ts`: opravit test, ne odstraňovat error boundary.
2. Homepage používá vzhled tlačítka na `NuxtLink` proti existujícímu UI kontraktu. Zkontrolovat konkrétní odkaz a převést na existující tlačítkovou komponentu s `to`, případně doložit, proč má kontrakt výjimku. Neumlčovat test plošně.

Formátování je i v souborech mimo poslední úpravy. Nedělat slepý fixer přes sdílený pracovní strom; nejdřív oddělit záměrné změny.

## Co je už postavené dobře

- Centrální tenant membership/scope guardy, explicitní selecty na řadě citlivých endpointů a ZenStack policies.
- Podpisy Stripe/Shopify webhooků, idempotentní příděly článků a transakční účetnictví.
- SSR sanitizace článků a sandbox HTML widgetů včetně ochrany přímého otevření dokumentu.
- Kontrolované veřejné HTTPS fetchování s DNS pinningem a omezenou velikostí odpovědi pro citlivé importy.
- Atomické claim/lease mechanismy v několika frontách, monitoring úloh, oddělení interní AI telemetrie od úspěchu výsledku.
- Záměrné oddělení anonymní a personalizované serverové feed cache, připravené testy pro více rozlišení/jazyků a produkční asset smoke.

## Další frontend a údržba

- Kvůli nearly-instant navigaci ponechat SSR data nutná pro hlavní obsah, ale sekundární stav nenačítat blokujícím způsobem. Například `app/pages/clanky/[slug].vue:234` čeká i na follows; pro guest ho lze přeskočit a pro přihlášené uživatele načíst nezávisle. Ověřit throttlovanou SPA navigaci, nevyvozovat produkční rychlost z dev serveru.
- Doplnit výškové i šířkové browser scénáře: sidebar otevřený/zavřený, dlouhý titulek, 320 px, desktop s malou výškou a zvětšení textu. Hero stále používá minimální výšku karty 28 rem, takže centrování nemůže být garantované na libovolně nízké obrazovce; definovat rozumný breakpoint pro přechod do běžného scrollovaného layoutu.
- `Workspace.vue` má 1 389 řádků, scheduled generation 885. Není důvod je přepisovat. Při opravách vytahovat konkrétní ucelené části s testovatelnou odpovědností; prioritu mají uvedené bezpečnostní a stavové chyby, ne kosmetické refaktory.
- Sjednotit dokumentaci se skutečným layoutem a názvy runtime konfigurace. Například `.env.example` uvádí `NUXT_CDN_URL`, zatímco veřejný runtime klíč je `public.cdnUrl` (`NUXT_PUBLIC_CDN_URL`) a build čte `CDN_URL`.
- Ověřit na Linuxu skutečný image, čistou instalaci se zamčenými verzemi a obnovu ze zálohy. Úspěšný lokální Nuxt build ani existující dump samy nedokazují obnovitelnost produkce.

## Doporučené pořadí práce

1. Uzavřít upload/CDN vlastnictví, veřejné DTO a cron autentizaci; přidat negativní testy přes tenanty.
2. Zprovoznit vynucení expirace trialu, deaktivace tenantu a zrušení sessions při resetu hesla.
3. Opravit Stripe pořadí událostí a scope service worker cache.
4. Oddělit migrace od Docker buildu; stanovit a otestovat konkrétní release/restore postup.
5. Opravit souběh publikace, lease překladů, pozvánky a invalidaci cache.
6. Zmenšit feed dotazy, omezit fallback cache/DB timeouts a oddělit síťový logging.
7. Zelená CI, cílené PostgreSQL concurrency testy a produkční E2E na samostatné DB. Až potom schválit release.

Žádná z uvedených oprav není v tomto auditu označena za implementovanou. Nebyl proveden commit ani push.
