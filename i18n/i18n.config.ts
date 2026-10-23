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

export default defineI18nConfig(() => ({
  legacy: false,
  globalInjection: true,

  pluralRules: {
    cs: czechPluralIndex,
  },

  numberFormats: {
    en: {
      currency: {
        style: 'currency',
        currencyDisplay: 'narrowSymbol',
      },
    },
    cs: {
      currency: {
        style: 'currency',
        currencyDisplay: 'narrowSymbol',
      },
    },
    de: {
      currency: {
        style: 'currency',
        currencyDisplay: 'narrowSymbol',
      },
    },
    fr: {
      currency: {
        style: 'currency',
        currencyDisplay: 'narrowSymbol',
      },
    },
  },
}))
