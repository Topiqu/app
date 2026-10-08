import { z } from 'zod'

import type { Language } from './language'

import { isManagedDomain } from './domain'
import { LanguageSchema } from '../siteSchemas'

export const MAX_WIDGETS = 20
export const MAX_PER_SLOT = 3
export const MAX_HTML_BYTES = 50_000

export const WIDGET_KINDS = ['ANNOUNCEMENT', 'DIVIDER', 'CTA', 'PRICE', 'WEATHER', 'HTML'] as const
export type WidgetKind = (typeof WIDGET_KINDS)[number]

const BLOCKS = ['CTA', 'PRICE', 'WEATHER', 'HTML'] as const satisfies readonly WidgetKind[]

/** Slots the layout renders, each with the kinds it accepts. */
export const WIDGET_SLOTS = {
  BAR: ['ANNOUNCEMENT'],
  HOME_TOP: ['DIVIDER', ...BLOCKS],
  HOME_MIDDLE: ['DIVIDER', ...BLOCKS],
  HOME_BOTTOM: ['DIVIDER', ...BLOCKS],
  ARTICLE_END: BLOCKS,
  FOOTER: BLOCKS,
} as const satisfies Record<string, readonly WidgetKind[]>
export type WidgetSlot = keyof typeof WIDGET_SLOTS

// A slot a redesign removes maps here, so its widgets move instead of silently vanishing.
const RETIRED_SLOTS: Record<string, WidgetSlot> = {}

export const resolveWidgetSlot = (slot: string): WidgetSlot | null =>
  slot in WIDGET_SLOTS ? (slot as WidgetSlot) : (RETIRED_SLOTS[slot] ?? null)

const PAID_PLANS = ['PRO', 'PREMIUM', 'CUSTOM']

export type WidgetSite = { plan?: string | null; domain?: string | null; domainVerified?: boolean | null }

/** Announcements are on every plan; the rest needs Pro, and HTML a verified own domain as well. */
export const widgetAllowed = (kind: WidgetKind, site: WidgetSite) => {
  if (kind === 'ANNOUNCEMENT') return true
  if (!PAID_PLANS.includes(site.plan ?? '')) return false
  return kind !== 'HTML' || (!!site.domainVerified && !!site.domain && !isManagedDomain(site.domain))
}

// Relative paths stay on the tenant's site; `//host` is protocol-relative, so it is not one.
const isSafeLink = (url: string) => {
  if (/^\/(?![/\\])/.test(url)) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
const link = z.string().trim().min(1).max(2048).refine(isSafeLink)
const instant = z.iso.datetime({ offset: true }).nullable().default(null)

export const ANNOUNCEMENT_TONES = ['info', 'accent', 'warning'] as const

export const announcementConfigSchema = z
  .object({
    text: z.string().trim().min(1).max(200),
    link: z.object({ url: link, label: z.string().trim().min(1).max(40) }).nullable().default(null),
    tone: z.enum(ANNOUNCEMENT_TONES).default('info'),
    dismissible: z.boolean().default(true),
    startsAt: instant,
    endsAt: instant,
  })
  .refine((c) => !c.startsAt || !c.endsAt || Date.parse(c.startsAt) < Date.parse(c.endsAt), { path: ['endsAt'] })
export type AnnouncementConfig = z.infer<typeof announcementConfigSchema>

export const DIVIDER_STYLES = ['line', 'dots', 'wave', 'space'] as const
export const dividerConfigSchema = z.object({
  style: z.enum(DIVIDER_STYLES).default('line'),
  label: z.string().trim().max(60).nullable().default(null),
})
export type DividerConfig = z.infer<typeof dividerConfigSchema>

export const ctaConfigSchema = z.object({
  title: z.string().trim().min(1).max(80),
  text: z.string().trim().max(280).default(''),
  button: z.object({ url: link, label: z.string().trim().min(1).max(40) }),
  // `url` is filled by the server from the tenant's own media asset, never taken from the body.
  image: z.object({ assetId: z.string().min(1), url: z.string().optional(), alt: z.string().max(200).default('') }).nullable().default(null),
  tone: z.enum(['info', 'accent']).default('accent'),
})
export type CtaConfig = z.infer<typeof ctaConfigSchema>

export const FIAT = ['EUR', 'USD', 'GBP', 'PLN', 'CZK', 'CHF', 'HUF', 'SEK', 'NOK', 'DKK', 'JPY', 'CAD', 'AUD'] as const
export const CRYPTO = ['BTC', 'ETH', 'SOL'] as const
export const priceConfigSchema = z
  .object({
    assets: z.array(z.enum([...CRYPTO, ...FIAT])).min(1).max(6),
    quote: z.enum(FIAT),
  })
  .refine((c) => !c.assets.includes(c.quote), { path: ['assets'] })
export type PriceConfig = z.infer<typeof priceConfigSchema>

export const weatherConfigSchema = z.object({
  place: z.object({
    name: z.string().trim().min(1).max(80),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  days: z.number().int().min(1).max(5).default(3),
})
export type WeatherConfig = z.infer<typeof weatherConfigSchema>

export const htmlConfigSchema = z.object({
  title: z.string().trim().min(1).max(80),
  html: z.string().min(1).refine((html) => new TextEncoder().encode(html).length <= MAX_HTML_BYTES),
  height: z.number().int().min(40).max(2000).default(240),
})
export type HtmlConfig = z.infer<typeof htmlConfigSchema>

export const WIDGET_CONFIG_SCHEMAS = {
  ANNOUNCEMENT: announcementConfigSchema,
  DIVIDER: dividerConfigSchema,
  CTA: ctaConfigSchema,
  PRICE: priceConfigSchema,
  WEATHER: weatherConfigSchema,
  HTML: htmlConfigSchema,
} as const satisfies Record<WidgetKind, z.ZodType>

const base = { id: z.string().optional(), slot: z.string(), active: z.boolean(), languages: z.array(LanguageSchema).max(4) }
const widgetInputSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('ANNOUNCEMENT'), config: announcementConfigSchema }),
  z.object({ ...base, kind: z.literal('DIVIDER'), config: dividerConfigSchema }),
  z.object({ ...base, kind: z.literal('CTA'), config: ctaConfigSchema }),
  z.object({ ...base, kind: z.literal('PRICE'), config: priceConfigSchema }),
  z.object({ ...base, kind: z.literal('WEATHER'), config: weatherConfigSchema }),
  z.object({ ...base, kind: z.literal('HTML'), config: htmlConfigSchema }),
])
export type WidgetInput = z.infer<typeof widgetInputSchema>

const windowsOverlap = (a: AnnouncementConfig, b: AnnouncementConfig) =>
  (a.startsAt ? Date.parse(a.startsAt) : -Infinity) < (b.endsAt ? Date.parse(b.endsAt) : Infinity) &&
  (b.startsAt ? Date.parse(b.startsAt) : -Infinity) < (a.endsAt ? Date.parse(a.endsAt) : Infinity)

const languagesOverlap = (a: Language[], b: Language[]) => !a.length || !b.length || a.some((l) => b.includes(l))

export const widgetsInputSchema = z
  .object({ widgets: z.array(widgetInputSchema).max(MAX_WIDGETS) })
  .superRefine(({ widgets }, ctx) => {
    const perSlot = new Map<string, number>()
    widgets.forEach((widget, i) => {
      const kinds: readonly string[] = WIDGET_SLOTS[widget.slot as WidgetSlot] ?? []
      if (!kinds.includes(widget.kind)) ctx.addIssue({ code: 'custom', message: 'SLOT_KIND', path: ['widgets', i, 'slot'] })
      const count = (perSlot.get(widget.slot) ?? 0) + (widget.active && widget.slot !== 'BAR' ? 1 : 0)
      perSlot.set(widget.slot, count)
      if (count > MAX_PER_SLOT) ctx.addIssue({ code: 'custom', message: 'SLOT_FULL', path: ['widgets', i, 'slot'] })
    })

    // One bar per reader: two active announcements may share a language only in different time windows.
    const bars = widgets.filter((w) => w.active && w.kind === 'ANNOUNCEMENT') as Extract<WidgetInput, { kind: 'ANNOUNCEMENT' }>[]
    bars.forEach((a, i) => {
      if (bars.slice(0, i).some((b) => languagesOverlap(a.languages, b.languages) && windowsOverlap(a.config, b.config)))
        ctx.addIssue({ code: 'custom', message: 'ANNOUNCEMENT_OVERLAP', path: ['widgets', widgets.indexOf(a)] })
    })
  })

export type PublicWidget = { id: string; kind: WidgetKind; slot: string; languages: Language[]; config: unknown }

/** What a reader's page receives: allowed kinds only, and never the HTML body, which the frame route serves. */
export const publicWidgets = (widgets: readonly PublicWidget[], site: WidgetSite): PublicWidget[] =>
  widgets
    .filter((widget) => widgetAllowed(widget.kind, site))
    .map((widget) => {
      if (widget.kind !== 'HTML') return widget
      const { title, height } = (widget.config ?? {}) as Partial<HtmlConfig>
      return { ...widget, config: { title, height } }
    })

/** Widgets for one slot and language, in order, with each config validated. */
export const slotWidgets = (widgets: readonly PublicWidget[], slot: WidgetSlot, locale: string) =>
  widgets.filter(
    (widget) =>
      resolveWidgetSlot(widget.slot) === slot &&
      (!widget.languages.length || widget.languages.includes(locale as Language)),
  )

export const activeAnnouncement = (widgets: readonly PublicWidget[], locale: string, now = Date.now()) => {
  for (const widget of slotWidgets(widgets, 'BAR', locale)) {
    if (widget.kind !== 'ANNOUNCEMENT') continue
    const parsed = announcementConfigSchema.safeParse(widget.config)
    if (!parsed.success) continue
    const { startsAt, endsAt } = parsed.data
    if ((startsAt && Date.parse(startsAt) > now) || (endsAt && Date.parse(endsAt) <= now)) continue
    return { id: widget.id, ...parsed.data }
  }
  return null
}

/** Changes with the visible text, so an edited bar shows again to readers who closed the old one. */
export const announcementKey = (id: string, config: Pick<AnnouncementConfig, 'text' | 'link'>) => {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify([config.text, config.link])) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  return `${id}.${(hash >>> 0).toString(36)}`
}
