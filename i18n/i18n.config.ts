import { czechPluralIndex } from '../shared/utils/plural'

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
  },
}))
