import { FIAT, type WidgetInput, type WidgetKind, type WidgetSlot } from '~~/shared/utils/widgets'

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
    config: () => ({ text: '', link: null, tone: 'info', dismissible: true, startsAt: null, endsAt: null }),
  },
  { id: 'dividerLine', kind: 'DIVIDER', icon: 'mdi:minus', slot: 'HOME_MIDDLE', config: () => ({ style: 'line', label: null }) },
  { id: 'dividerDots', kind: 'DIVIDER', icon: 'mdi:dots-horizontal', slot: 'HOME_MIDDLE', config: () => ({ style: 'dots', label: null }) },
  { id: 'dividerWave', kind: 'DIVIDER', icon: 'mdi:wave', slot: 'HOME_MIDDLE', config: () => ({ style: 'wave', label: null }) },
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
  { id: 'html', kind: 'HTML', icon: 'mdi:code-tags', slot: 'HOME_BOTTOM', config: () => ({ title: '', html: '', height: 240 }) },
]
