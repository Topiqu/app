import { describe, expect, it } from 'vitest'

import {
  activeAnnouncement,
  announcementConfigSchema,
  announcementKey,
  publicWidgets,
  widgetAllowed,
  widgetsInputSchema,
  type PublicWidget,
  type WidgetInput,
} from '../../shared/utils/widgets'

const config = (overrides: Record<string, unknown> = {}) => ({ text: 'Big news', ...overrides })
const bar = (overrides: Partial<WidgetInput> = {}, configOverrides: Record<string, unknown> = {}) => ({
  kind: 'ANNOUNCEMENT' as const,
  slot: 'BAR' as const,
  active: true,
  languages: [],
  config: config(configOverrides),
  ...overrides,
})

describe('announcementConfigSchema', () => {
  it.each(['https://shop.example.com/sale', '/cs/clanky/novinka'])('accepts %s as a link', (url) => {
    expect(announcementConfigSchema.safeParse(config({ link: { url, label: 'More' } })).success).toBe(true)
  })

  it.each(['//evil.example.com', 'javascript:alert(1)', 'http://example.com', 'data:text/html,x'])(
    'rejects %s as a link',
    (url) => {
      expect(announcementConfigSchema.safeParse(config({ link: { url, label: 'More' } })).success).toBe(false)
    },
  )

  it('requires text and an end after the start', () => {
    expect(announcementConfigSchema.safeParse(config({ text: '   ' })).success).toBe(false)
    const backwards = config({ startsAt: '2026-10-10T10:00:00.000Z', endsAt: '2026-10-09T10:00:00.000Z' })
    expect(announcementConfigSchema.safeParse(backwards).success).toBe(false)
  })
})

describe('widgetsInputSchema', () => {
  const overlap = (widgets: unknown[]) =>
    widgetsInputSchema.safeParse({ widgets }).error?.issues.some((issue) => issue.message === 'ANNOUNCEMENT_OVERLAP')

  it('refuses two active bars for the same reader at the same time', () => {
    expect(overlap([bar(), bar({ languages: ['cs'] })])).toBe(true)
    expect(overlap([bar({ languages: ['cs', 'en'] }), bar({ languages: ['en'] })])).toBe(true)
  })

  it('allows bars that differ in language, time window or activity', () => {
    expect(overlap([bar({ languages: ['cs'] }), bar({ languages: ['en'] })])).toBeFalsy()
    expect(
      overlap([
        bar({}, { endsAt: '2026-10-10T00:00:00.000Z' }),
        bar({}, { startsAt: '2026-10-10T00:00:00.000Z' }),
      ]),
    ).toBeFalsy()
    expect(overlap([bar(), bar({ active: false })])).toBeFalsy()
  })

  it('accepts only the slots a kind may use', () => {
    expect(widgetsInputSchema.safeParse({ widgets: [{ ...bar(), slot: 'FOOTER' }] }).success).toBe(false)
  })
})

describe('activeAnnouncement', () => {
  const now = Date.parse('2026-10-08T12:00:00.000Z')
  const widget = (overrides: Partial<PublicWidget> = {}, configOverrides: Record<string, unknown> = {}): PublicWidget => ({
    id: 'w1',
    kind: 'ANNOUNCEMENT',
    slot: 'BAR',
    languages: [],
    config: config(configOverrides),
    ...overrides,
  })

  it('picks the first bar for the reader’s language', () => {
    const widgets = [widget({ id: 'en', languages: ['en'] }), widget({ id: 'any' })]
    expect(activeAnnouncement(widgets, 'cs', now)?.id).toBe('any')
    expect(activeAnnouncement(widgets, 'en', now)?.id).toBe('en')
  })

  it('respects the time window', () => {
    expect(activeAnnouncement([widget({}, { startsAt: '2026-10-09T00:00:00.000Z' })], 'cs', now)).toBeNull()
    expect(activeAnnouncement([widget({}, { endsAt: '2026-10-08T12:00:00.000Z' })], 'cs', now)).toBeNull()
  })

  it('skips a stored config that no longer validates and a slot the layout does not know', () => {
    expect(activeAnnouncement([widget({}, { text: '' })], 'cs', now)).toBeNull()
    expect(activeAnnouncement([widget({ slot: 'GONE' })], 'cs', now)).toBeNull()
  })
})

describe('announcementKey', () => {
  it('changes with the visible text, not with the styling', () => {
    const base = { text: 'Hello', link: null }
    expect(announcementKey('w1', base)).toBe(announcementKey('w1', { ...base }))
    expect(announcementKey('w1', base)).not.toBe(announcementKey('w1', { ...base, text: 'Hello!' }))
    expect(announcementKey('w1', base)).not.toBe(announcementKey('w2', base))
  })
})

describe('widgetAllowed', () => {
  const own = { domain: 'blog.example.cz', domainVerified: true }

  it('gives announcements to every plan and the rest to paid plans', () => {
    expect(widgetAllowed('ANNOUNCEMENT', { plan: 'BASIC' })).toBe(true)
    expect(widgetAllowed('CTA', { plan: 'BASIC' })).toBe(false)
    expect(widgetAllowed('CTA', { plan: 'PRO' })).toBe(true)
  })

  it('serves HTML only on a verified own domain', () => {
    expect(widgetAllowed('HTML', { plan: 'PRO', ...own })).toBe(true)
    expect(widgetAllowed('HTML', { plan: 'PRO', domain: 'blog.example.cz', domainVerified: false })).toBe(false)
    expect(widgetAllowed('HTML', { plan: 'PRO', domain: 'acme.topiqu.com', domainVerified: true })).toBe(false)
    expect(widgetAllowed('HTML', { plan: 'BASIC', ...own })).toBe(false)
  })
})

describe('publicWidgets', () => {
  const html: PublicWidget = {
    id: 'h1',
    kind: 'HTML',
    slot: 'HOME_TOP',
    languages: [],
    config: { title: 'Form', html: '<script>x()</script>', height: 300 },
  }

  it('never ships the HTML body to the page', () => {
    const [widget] = publicWidgets([html], { plan: 'PRO', domain: 'blog.example.cz', domainVerified: true })
    expect(widget?.config).toEqual({ title: 'Form', height: 300 })
  })

  it('drops kinds the site no longer has', () => {
    expect(publicWidgets([html], { plan: 'BASIC' })).toEqual([])
  })
})

describe('widgetsInputSchema slots', () => {
  const cta = (slot: string, active = true) => ({
    kind: 'CTA',
    slot,
    active,
    languages: [],
    config: { title: 'Hi', button: { url: '/', label: 'Go' } },
  })

  it('caps active widgets per slot', () => {
    const issues = widgetsInputSchema.safeParse({ widgets: Array.from({ length: 4 }, () => cta('HOME_TOP')) }).error?.issues
    expect(issues?.some((issue) => issue.message === 'SLOT_FULL')).toBe(true)
    expect(widgetsInputSchema.safeParse({ widgets: [...Array.from({ length: 3 }, () => cta('HOME_TOP')), cta('HOME_TOP', false)] }).success).toBe(true)
  })

  it('keeps dividers on the homepage', () => {
    const divider = { kind: 'DIVIDER', slot: 'ARTICLE_END', active: true, languages: [], config: { style: 'line' } }
    expect(widgetsInputSchema.safeParse({ widgets: [divider] }).success).toBe(false)
  })

  it('refuses a price in its own currency', () => {
    const price = { kind: 'PRICE', slot: 'FOOTER', active: true, languages: [], config: { assets: ['EUR'], quote: 'EUR' } }
    expect(widgetsInputSchema.safeParse({ widgets: [price] }).success).toBe(false)
  })
})
