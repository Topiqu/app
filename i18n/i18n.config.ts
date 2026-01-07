export default defineI18nConfig(() => ({
  legacy: false,
  globalInjection: true,

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
