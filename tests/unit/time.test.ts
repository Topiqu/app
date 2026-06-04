import { describe, expect, it } from 'vitest'

import { TIME_PRESETS } from '../../shared/utils/time'

const fmt = (locale: string, preset: keyof typeof TIME_PRESETS, date: Date) =>
  new Intl.DateTimeFormat(locale, TIME_PRESETS[preset]).format(date)

const DATE = new Date(2026, 5, 4, 14, 5)

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
    expect(fmt('cs', 'datetime', DATE)).toContain(':')
    expect(fmt('cs', 'time', DATE)).toMatch(/^\d{2}:\d{2}$/)
  })

  it('zero-pads day and month in shortDatetime', () => {
    expect(fmt('cs', 'shortDatetime', DATE)).toMatch(/04\.\s?06\.\s?2026/)
  })
})
