# Udržovací revize — 8. října 2026

Revize zahrnuje závislosti a lockfile, používané AI modely, nevyužitý kód, duplicitní validaci, konfiguraci nástrojů, dokumentaci a ověření aplikace. Původní rozpracované změny widgetů, statistik a administrace byly zachovány. Žádný commit, push ani nasazení nebyly provedeny.

## Závislosti

Aktualizováno 82 deklarovaných verzí nebo rozsahů. Lockfile má 2223 záznamů oproti původním 2366. Tiptap i ZenStack zůstávají v celém projektu na jedné přesné verzi; AI SDK a provider jsou také připnuté.

| Balíček          | Před revizí | Po revizi |
| ---------------- | ----------- | --------- |
| nuxt             | 4.5.2       | 4.6.0     |
| vue              | ^3.5.24     | ^3.5.43   |
| @nuxt/ui         | 4.10.0      | 4.11.3    |
| @nuxt/image      | 2.0.0       | 2.1.0     |
| @nuxt/eslint     | 1.10.0      | 1.17.0    |
| @tiptap/core     | 3.30.1      | 3.31.4    |
| @zenstackhq/orm  | 3.9.6       | 3.9.7     |
| ai               | 7.0.37      | 7.0.133   |
| @ai-sdk/openai   | 4.0.27      | 4.0.89    |
| reka-ui          | 2.10.1      | 2.11.0    |
| zod              | 4.1.12      | 4.6.5     |
| sharp            | ^0.34.5     | ^0.35.5   |
| mjml             | ^4.17.1     | ^5.4.1    |
| @nuxtjs/i18n     | ^10.2.1     | ^10.6.0   |
| @vueuse/core     | ^14.0.0     | ^14.4.0   |
| @playwright/test | ^1.62.1     | ^1.64.0   |
| vitest           | ^4.1.6      | ^4.1.11   |

Odstraněny nepoužívané závislosti: `@ai-sdk/xai`, `@formkit/auto-animate`, `@nuxt/scripts`, `@unocss/preset-typography`, `@vueuse/motion`. Jejich Nuxt moduly byly odstraněny z konfigurace. ESLint, modul Nuxt ESLint a TypeScript jsou přesunuté mezi vývojové závislosti.

Přímé importy `h3`, `ofetch`, `@ai-sdk/provider`, `@ai-sdk/provider-utils`, `@intlify/message-compiler` a typů `nitropack` mají nyní odpovídající přímou závislost. Projekt tak nezávisí na náhodném hoistování tranzitivních balíčků. Balíčky ikon, Takumi, ORM schémat a typů jsou potřebné pro sestavení/generování, i když je běžný skener označuje za nevyužité.

## AI modely

| Úloha / poskytovatel                                     | Model                    | Rozhodnutí                                                                                   |
| -------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| Redakční úlohy OpenAI včetně writeru, research a editora | `gpt-5.6-luna`           | Zachováno původní rozdělení rolí; také topic scope, keyword opportunity a backlink matching. |
| Rutinní textové úlohy OpenAI                             | `gpt-6-luna`             | Zachována původní volba pro překlady a ostatní rutinní úlohy.                                |
| OpenAI visibility                                        | `gpt-6-luna`             | Sdílí model s registrem textových úloh.                                                      |
| Google visibility                                        | `gemini-3.8-flash`       | Zachována současná Flash řada.                                                               |
| Meta visibility                                          | `muse-spark-1.3`         | Zachována současná verze.                                                                    |
| Mistral visibility                                       | `mistral-medium-latest`  | Zachován průběžně aktualizovaný alias řady Medium.                                           |
| Generování obrázků                                       | `gpt-image-2.5-flare`    | Současná verze, explicitní medium quality.                                                   |
| Knowledge embeddings                                     | `text-embedding-3-small` | Zachováno 1536 rozměrů; změna vyžaduje migraci vektorů a přeindexování.                      |

Modely pro visibility jsou nově ve stejném centrálním registru jako ostatní AI úlohy. Zjednodušené směrování používá explicitně OpenAI Responses API. Odstraněny neúčinné parametry `temperature` z reasoning úloh. Rozpočty produkčního psaní a rešerší zůstávají zachované.

Původní rozdělení GPT-5.6 / GPT-6 pro textové úlohy je obnovené a hlídané původním testem. Aktualizace modelů Anthropic a xAI byla zrušena: projekt nemá jejich API klíče. Původní volitelné adaptéry zůstávají a bez klíčů se nespouštějí. Integrační test ověřuje model přímo v HTTP požadavku pro research, writer a překlady.

Dostupnost `gpt-6-luna`, `gpt-image-2.5-flare` a `text-embedding-3-small` pro nakonfigurovaný účet byla ověřena přes `GET /v1/models/{id}` (HTTP 200). Živý smoke test GPT-6 ověřil odpověď modelu a skutečně spuštěné nativní webové vyhledávání s vrácenou URL. Negeneroval obrázek a neměnil aplikační data. Nový integrační test používá skutečný AI SDK s mockovaným HTTP a ověřuje endpoint, reasoning, web search, strict structured output, odpověď i účtované tokeny. Testy nepoužívání vyřazených modelů pokrývají také registry visibility providerů. Další poskytovatelé byli prověřeni podle dokumentace a parserových testů; jejich živé API nebylo voláno.

Zdroje: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT Image 2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare), [Gemini modely](https://ai.google.dev/gemini-api/docs/models), [Meta Connect](https://developers.meta.com/blog/meta-connect-recap/), [Mistral modely](https://docs.mistral.ai/models).

## Úklid a konfigurace

- Odstraněny tři nepoužívané komponenty: `TurnstileWidget`, `Article/Editor/Chip`, `Article/Editor/Popover`; také nepoužívané wrappers `ai/tools/image.ts` a `ai/tools/index.ts`.
- Odstraněny nevyužité `resetGamTokenCache`, `findCoverImage`, `EXPIRED_TRIAL_TOKEN_LIMIT` a `SHOPIFY_SCOPES`. Shopify scopes mají jediný zdroj v `shopify.app.toml`.
- Interní e-mailové/i18n/GAM helpery a list-query schémata už nejsou zbytečně exportované. Shodná validace rozsahu dat klientů a článků je sdílená.
- Odstraněny zbytečné počáteční přiřazení zachycené novým ESLintem. Opraveny nullable hodnoty v Shopify odkazu, checklistu, doménových nastaveních a excerptu překladů.
- `build:docker` používá společný build script; odstraněn neexistující `vue-qrcode-reader` z optimalizace závislostí.
- Bun 1.4.2 zůstává runtime. Node 24.21.0 je připnutý pro kontrolu typů a browser tooling v `.prototools`, `.node-version` a všech CI jobs. Lokální systémový Node 23 nebyl měněn; kontroly běžely s izolovaným Node 24 ověřeným SHA-256 z oficiální distribuce.
- Postinstall a ZenStack generátor běží explicitně pod Bunem; Vue typechecker pod Node. Konfigurace minifikace byla převedena na Vite 8 / Oxc, protože nastavení `esbuild.drop` od nuxt-security bylo ignorované. [Migrace Vite 8](https://vite.dev/guide/migration.html#javascript-minification-by-oxc).
- Opraveno sestavení SSR na Windows: Nitro 2 nerozpoznával zpětná lomítka v cestě rendereru Nuxt 4.6, takže sestavený server vracel HTTP 500 kvůli chybějícímu manifestu. Explicitní inline pravidlo používá obě varianty oddělovače. [Upstream chyba Nuxt #36467](https://github.com/nuxt/nuxt/issues/36467).
- Opraveno zahrnutí dynamické závislosti IPX 4 v Bun buildu. Nitro původně zkopírovalo jen Bun adaptér `srvx`, ale IPX načítá `srvx/node` přes `createRequire`; explicitní `traceInclude` zahrnuje i tento entrypoint a jeho závislosti, aby `/_ipx` nevracelo 500.
- Vitest má čtyři workery a 60s timeout pro setup hooky. Čtyři Nuxt testové soubory při paralelním studeném startu překračovaly 30s; samostatně prošly, po úpravě prošla celá sada.
- Browser enginy byly aktualizované na verze odpovídající Playwright 1.64; jejich instalace je popsaná v README.
- README, CLAUDE.md, MAP.md, příklad prostředí a CI odpovídají Better Auth, Nuxt UI, Tailwind CSS, současným providerům a čtyřem jazykům. AI smoke script ověřuje neprázdný text a skutečné použití web search; `--skip-images` umožňuje kontrolu pouze textu a rešerše.

Skener prošel 863 zdrojových souborů. Zbývající podobnost filtrů tabulek klientů a článků nevyžaduje nový společný komponent: tabulky mají odlišné sloupce, oprávnění, query a akce. Společná serverová validace byla sjednocena.

## Bezpečnostní audit

První bezpečnostní audit po aktualizaci kompatibilních verzí hlásil 15 advisory u 11 balíčků (2 critical, 10 high, 2 moderate, 1 low). Opraveno 12 nálezů: `sharp` a jeho nativní kodeky, `mjml` a starý html-minifier, `prosemirror-view`, `simple-git` / argv-parser, `deepmerge-ts` a starší `esbuild`.

MJML 5 je ověřeno vykreslením všech osmi šablon ve čtyřech jazycích přes skutečný renderer, s mockovaným SES transportem. Chybová větev už nevypisuje celý zkompilovaný e-mail do logu.

Bezpečný simple-git 4 odstranil default export, který Nuxt DevTools 3 ještě používá. Jednořádkový Bun patch `patches/@nuxt%2Fdevtools@3.4.2.patch` mění import na podporovaný named export. Patch se aplikuje při frozen instalaci i v Dockeru. Odstranit ho lze po přechodu na kompatibilní stabilní DevTools. Přechod na DevTools 4 beta nebyl nutný. Overrides pro deepmerge-ts a esbuild jsou ověřeny generátorem, migracemi, testy a buildem.

Konečný audit zůstává nenulový: dvě high a jedna moderate advisory bez vydané opravené verze k datu revize.

| Balíček          | Nález                                                                                           | Řetězec                                            |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| braces 3.0.3     | [Vnořené glob patterny mohou vyčerpat stack](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | micromatch / globbing nástrojů                     |
| node-forge 1.4.0 | [Chybná RSA signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv)          | listhen / lokální TLS                              |
| sprintf-js 1.0.3 | [Neomezená precision ve formátu](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)             | argparse přes mammoth / js-yaml / coverage tooling |

V aplikaci není přímý import těchto knihoven. To samo o sobě nenahrazuje opravu upstream. Sledovat nové verze rodičů a opakovat `bun audit`; potlačení nálezů ani nahrazení nekompatibilní knihovnou nebylo použito.

## Ověření

| Kontrola                                                           | Výsledek                         |
| ------------------------------------------------------------------ | -------------------------------- |
| Frozen instalace se stejnými flags jako Docker / release CI        | Prošlo                           |
| ZenStack generování                                                | Prošlo                           |
| 117 migrací na čistém dočasném PostgreSQL 18 / pgvector            | Prošlo                           |
| ESLint                                                             | Prošlo                           |
| Vue / TypeScript kontrola s Node 24                                | Prošlo                           |
| OpenAPI kontrakt                                                   | Prošlo                           |
| Vitest včetně databázových integrací                               | Prošlo — 2021 testů, 279 souborů |
| Cílené AI testy po obnovení původních textových modelů             | Prošlo — 249 testů, 26 souborů   |
| Živý OpenAI text + web search smoke                                | Prošlo                           |
| Produkční Bun build s Vite 8 minifikací                            | Prošlo                           |
| Playwright release smoke nad sestaveným serverem                   | Prošlo — 2 testy                 |
| CI peněženka: desktop Chromium + mobilní WebKit včetně auth setupu | Prošlo — 5 testů                 |

22 testů v šesti AI eval souborech zůstává záměrně vypnutých bez `AI_EVAL=1`. Nebylo prováděno hromadné placené hodnocení kvality článků ani živé posílání e-mailů. Databázové migrace a browser fixtures byly použity pouze v samostatném dočasném kontejneru, nikoliv v uživatelské vývojové nebo produkční databázi.

Úplná testová sada, build, živý smoke GPT-6 a E2E kontroly proběhly před obnovením původního rozdělení textových modelů. Po obnovení byly znovu spuštěny cílené AI testy, lint a kontrola typů; request contract používá skutečný SDK s mockovaným HTTP. Živá kvalita výstupu GPT-5.6 ani nový produkční build po této korekci ověřované nebyly.

## Držené kompatibilní větve

Tyto balíčky jsou aktualizované v používané větvi; jejich nejnovější major verze znamená samostatnou migraci:

| Balíček                     | Použitá větev | Nejnovější vydání k datu revize |
| --------------------------- | ------------- | ------------------------------- |
| stripe                      | ^18.5.0       | 23.0.0                          |
| otplib                      | ^12.0.1       | 13.5.0                          |
| pinia                       | ^3.0.4        | 4.0.3                           |
| vue-router                  | ^4.6.4        | 5.4.0                           |
| typescript                  | ^5.9.3        | 7.0.2                           |
| vitest                      | ^4.1.11       | 5.0.3                           |
| jsdom                       | ^28.1.0       | 30.1.2                          |
| @sentry/nuxt                | ^10.76.1      | 11.5.0                          |
| eslint                      | ^9.39.5       | 10.12.0                         |
| eslint-plugin-perfectionist | ^4.15.1       | 5.12.1                          |
| pdfkit                      | ^0.17.2       | 0.20.2                          |
| isomorphic-dompurify        | ^2.36.0       | 4.5.0                           |

Stripe a otplib vyžadují zvláštní ověření platebních/webhook a OTP/2FA smluv. Vue Router 5 by měl zahrnout revizi typed routes a odstranění současného Volar bridge. Pinia, Sentry a DOMPurify vyžadují revizi modulů a integračních smluv; DOMPurify/jsdom zvlášť HTML sanitizaci. Vitest, jsdom, TypeScript a ESLint je vhodné migrovat společně s podporou Nuxt Test Utils / Vue language tools / lint pluginů. PDFKit 0.20 vyžaduje ověřit render/export. Tyto změny nebyly vynuceny override bez ověření kompatibility.

Dockerfile stále spouští `bun release` v prerelease stage s build-time `DATABASE_URL`. Přesunutí migrací do samostatného deploy/release kroku vyžaduje úpravu Dokploy workflow; revize zachovala současné nasazovací chování. Lokální build test tento Docker krok nespouštěl. Výstup buildu má nativní Sharp binárky pro Windows; produkční Linux image se sestavuje na cílové platformě.

Zůstávají varování o velikosti client chunků, některých nepodporovaných stylech/fontu OG šablon a Vue injections/slotech při SSR. Ověřené browser scénáře prošly i přes tato varování; úplná vizuální sada a Linux Docker image nebyly lokálně ověřené.
