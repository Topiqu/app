// Keep this runtime config self-contained: Nuxt emits it into a cache directory where relative
// imports back into the repository no longer resolve during the Nitro bundle.
const czechPluralIndex = (choice: number, choicesLength = 4) => {
  if (choicesLength === 1) return 0
  if (choicesLength === 2) return choice === 1 ? 0 : 1
  if (choicesLength === 3) return choice === 1 ? 0 : choice >= 2 && choice <= 4 ? 1 : 2
  if (choice === 0) return 0
  if (choice === 1) return 1
  if (choice >= 2 && choice <= 4) return 2
  return 3
}

const polishPluralIndex = (choice: number, choicesLength = 4) => {
  if (choicesLength === 1) return 0
  const few = choice % 10 >= 2 && choice % 10 <= 4 && (choice % 100 < 12 || choice % 100 > 14)
  if (choicesLength === 2) return choice === 1 ? 0 : 1
  if (choicesLength === 3) return choice === 1 ? 0 : few ? 1 : 2
  if (choice === 0) return 0
  if (choice === 1) return 1
  return few ? 2 : 3
}

const currency = { currency: { style: 'currency' as const, currencyDisplay: 'narrowSymbol' as const } }

export default defineI18nConfig(() => ({
  legacy: false,
  globalInjection: true,

  // Content-only locales ship reader-facing keys only. Slovak readers understand Czech better than English.
  fallbackLocale: { es: ['en'], it: ['en'], pl: ['en'], sk: ['cs'], nl: ['en'], pt: ['en'] },

  pluralRules: {
    cs: czechPluralIndex,
    sk: czechPluralIndex,
    pl: polishPluralIndex,
  },

  numberFormats: {
    en: currency,
    cs: currency,
    de: currency,
    fr: currency,
    es: currency,
    it: currency,
    pl: currency,
    sk: currency,
    nl: currency,
    pt: currency,
  },
}))
