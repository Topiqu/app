import { describe, expect, it } from 'vitest'

import { formatArticleDate, TIME_PRESETS, TOPIQU_TIME_ZONE } from '../../shared/utils/time'

const fmt = (locale: string, preset: keyof typeof TIME_PRESETS, date: Date) =>
  new Intl.DateTimeFormat(locale, TIME_PRESETS[preset]).format(date)

const DATE = new Date('2026-06-04T12:05:00Z')

describe('TIME_PRESETS', () => {
  it('renders a localized long date per locale', () => {
    expect(fmt('cs', 'date', DATE)).toContain('června')
    expect(fmt('cs', 'date', DATE)).toContain('2026')

    const en = fmt('en-US', 'date', DATE)
    expect(en).toContain('June')
    expect(en).toContain('2026')
  })

  it('uses locale-specific separators for the short date', () => {
    expect(fmt('cs', 'short', DATE)).toMatch(/4\.\s?6\.\s?2026/)
    expect(fmt('en-US', 'short', DATE)).toContain('/')
  })

  it('includes time for datetime and time presets', () => {
    expect(fmt('cs', 'datetime', DATE)).toContain('14:05')
    expect(fmt('cs', 'time', DATE)).toBe('14:05')
  })

  it('zero-pads day and month in shortDatetime', () => {
    expect(fmt('cs', 'shortDatetime', DATE)).toMatch(/04\.\s?06\.\s?2026/)
  })

  it('pins dates to one timezone for SSR and hydration', () => {
    expect(TOPIQU_TIME_ZONE).toBe('Europe/Prague')
    expect(formatArticleDate(DATE, 'cs')).toBe('4. června 2026, 14:05')
    expect(formatArticleDate(DATE, 'en')).toBe('Jun 4, 2026, 14:05')
  })
})
