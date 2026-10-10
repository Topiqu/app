import {
  FIAT,
  DEFAULT_ANNOUNCEMENT_APPEARANCE,
  type PriceConfig,
  type PriceData,
  type WeatherData,
  type WidgetInput,
  type WidgetKind,
  type WidgetSlot,
} from '~~/shared/utils/widgets'

export type WidgetDraft = WidgetInput & { key: string }

export const WIDGET_ICONS: Record<WidgetKind, string> = {
  ANNOUNCEMENT: 'mdi:bullhorn-outline',
  DIVIDER: 'mdi:minus',
  CTA: 'mdi:gesture-tap-button',
  PRICE: 'mdi:chart-line',
  WEATHER: 'mdi:weather-partly-cloudy',
  HTML: 'mdi:code-tags',
}

type PresetContext = { t: (key: string) => string; currency: string }
type Preset = { id: string; kind: WidgetKind; icon: string; slot: WidgetSlot; config: (ctx: PresetContext) => unknown }

const quoteFor = (currency: string, avoid: string[] = []) => {
  const code = (FIAT as readonly string[]).includes(currency) ? currency : 'EUR'
  return avoid.includes(code) ? (code === 'USD' ? 'EUR' : 'USD') : code
}

/** Starting points for the "add widget" gallery; each becomes an ordinary, fully editable widget. */
export const WIDGET_PRESETS: Preset[] = [
  {
    id: 'announcement',
    kind: 'ANNOUNCEMENT',
    icon: 'mdi:bullhorn-outline',
    slot: 'BAR',
    config: () => ({
      text: '',
      link: null,
      tone: 'info',
      appearance: { ...DEFAULT_ANNOUNCEMENT_APPEARANCE },
      dismissible: true,
      startsAt: null,
      endsAt: null,
    }),
  },
  {
    id: 'dividerLine',
    kind: 'DIVIDER',
    icon: 'mdi:minus',
    slot: 'HOME_MIDDLE',
    config: () => ({ style: 'line', label: null }),
  },
  {
    id: 'dividerDots',
    kind: 'DIVIDER',
    icon: 'mdi:dots-horizontal',
    slot: 'HOME_MIDDLE',
    config: () => ({ style: 'dots', label: null }),
  },
  {
    id: 'dividerWave',
    kind: 'DIVIDER',
    icon: 'mdi:wave',
    slot: 'HOME_MIDDLE',
    config: () => ({ style: 'wave', label: null }),
  },
  {
    id: 'ctaNewsletter',
    kind: 'CTA',
    icon: 'mdi:email-newsletter',
    slot: 'ARTICLE_END',
    config: ({ t }) => ({
      title: t('widgets.presets.ctaNewsletter.title'),
      text: t('widgets.presets.ctaNewsletter.text'),
      button: { url: '', label: t('widgets.presets.ctaNewsletter.button') },
      image: null,
      tone: 'accent',
    }),
  },
  {
    id: 'ctaContact',
    kind: 'CTA',
    icon: 'mdi:message-text-outline',
    slot: 'ARTICLE_END',
    config: ({ t }) => ({
      title: t('widgets.presets.ctaContact.title'),
      text: t('widgets.presets.ctaContact.text'),
      button: { url: '', label: t('widgets.presets.ctaContact.button') },
      image: null,
      tone: 'info',
    }),
  },
  {
    id: 'priceBitcoin',
    kind: 'PRICE',
    icon: 'mdi:bitcoin',
    slot: 'HOME_MIDDLE',
    config: ({ currency }) => ({ assets: ['BTC'], quote: quoteFor(currency) }),
  },
  {
    id: 'priceCrypto',
    kind: 'PRICE',
    icon: 'mdi:chart-line',
    slot: 'HOME_MIDDLE',
    config: ({ currency }) => ({ assets: ['BTC', 'ETH', 'SOL'], quote: quoteFor(currency) }),
  },
  {
    id: 'priceFiat',
    kind: 'PRICE',
    icon: 'mdi:currency-eur',
    slot: 'HOME_MIDDLE',
    config: ({ currency }) => {
      const quote = quoteFor(currency)
      return { assets: ['EUR', 'USD', 'GBP', 'PLN'].filter((code) => code !== quote), quote }
    },
  },
  {
    id: 'weather',
    kind: 'WEATHER',
    icon: 'mdi:weather-partly-cloudy',
    slot: 'HOME_TOP',
    config: () => ({ place: { name: '', lat: 0, lon: 0 }, days: 3 }),
  },
  {
    id: 'html',
    kind: 'HTML',
    icon: 'mdi:code-tags',
    slot: 'HOME_BOTTOM',
    config: () => ({ title: '', html: '', height: 240 }),
  },
]

export const LIBRARY_CATEGORIES = {
  notice: ['ANNOUNCEMENT'],
  layout: ['DIVIDER'],
  action: ['CTA'],
  data: ['PRICE', 'WEATHER'],
  custom: ['HTML'],
} as const satisfies Record<string, readonly WidgetKind[]>
export type LibraryCategory = keyof typeof LIBRARY_CATEGORIES

// Rough values in EUR, for the library's thumbnails only; live widgets always load real rates.
const SAMPLE_EUR: Record<string, number> = {
  BTC: 92_000,
  ETH: 3300,
  SOL: 170,
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  PLN: 0.23,
  CZK: 0.04,
  CHF: 1.06,
  HUF: 0.0025,
  SEK: 0.088,
  NOK: 0.085,
  DKK: 0.134,
  JPY: 0.0061,
  CAD: 0.66,
  AUD: 0.6,
}

export const samplePrices = ({ assets, quote }: PriceConfig): PriceData => ({
  quote,
  asOf: new Date().toISOString(),
  prices: assets.map((asset) => ({ asset, value: SAMPLE_EUR[asset]! / SAMPLE_EUR[quote]! })),
})

const SAMPLE_DAYS = [
  ['partlycloudy_day', 18, 9],
  ['clearsky_day', 21, 10],
  ['rainshowers_day', 15, 8],
  ['cloudy', 16, 7],
  ['fair_day', 19, 9],
] as const

export const sampleWeather = (): WeatherData => {
  const today = new Date().setUTCHours(0, 0, 0, 0)
  return {
    current: { temp: 17, symbol: 'partlycloudy_day' },
    days: SAMPLE_DAYS.map(([symbol, max, min], index) => ({
      date: new Date(today + index * 86_400_000).toISOString().slice(0, 10),
      symbol,
      max,
      min,
    })),
  }
}
