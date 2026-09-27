import { describe, expect, it } from 'vitest'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'

import { formatDateInput, parseDateInput } from '~/utils/dateInput'

describe('parseDateInput', () => {
  it('parses native date and datetime-local strings', () => {
    expect(parseDateInput('2026-09-27', false)).toEqual(new CalendarDate(2026, 9, 27))
    expect(parseDateInput('2026-09-27T14:30', true)).toEqual(new CalendarDateTime(2026, 9, 27, 14, 30))
  })

  it('truncates seconds and ISO suffixes to the input granularity', () => {
    expect(parseDateInput('2026-09-27T14:30:59.000Z', true)).toEqual(new CalendarDateTime(2026, 9, 27, 14, 30))
    expect(parseDateInput('2026-09-27T14:30:59.000Z', false)).toEqual(new CalendarDate(2026, 9, 27))
  })

  it('reads a date-only value as midnight in time mode', () => {
    expect(parseDateInput('2026-09-27', true)).toEqual(new CalendarDateTime(2026, 9, 27, 0, 0))
  })

  it('returns undefined for empty or malformed values', () => {
    expect(parseDateInput(null, true)).toBeUndefined()
    expect(parseDateInput('', false)).toBeUndefined()
    expect(parseDateInput('not-a-date', false)).toBeUndefined()
  })
})

describe('formatDateInput', () => {
  it('emits the native input formats', () => {
    expect(formatDateInput(new CalendarDate(2026, 1, 5), false)).toBe('2026-01-05')
    expect(formatDateInput(new CalendarDateTime(2026, 1, 5, 9, 7, 45), true)).toBe('2026-01-05T09:07')
  })

  it('widens a date to midnight and narrows a datetime to its day', () => {
    expect(formatDateInput(new CalendarDate(2026, 1, 5), true)).toBe('2026-01-05T00:00')
    expect(formatDateInput(new CalendarDateTime(2026, 1, 5, 9, 7), false)).toBe('2026-01-05')
  })

  it('emits an empty string when cleared', () => {
    expect(formatDateInput(undefined, true)).toBe('')
  })

  it('round-trips', () => {
    expect(formatDateInput(parseDateInput('2026-12-31T23:59', true), true)).toBe('2026-12-31T23:59')
  })
})
