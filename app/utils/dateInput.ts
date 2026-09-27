import { parseDate, parseDateTime, toCalendarDateTime, type DateValue } from '@internationalized/date'

// Values keep the native `<input type="date|datetime-local">` string format, so callers and APIs are unchanged.
export const parseDateInput = (value: string | null | undefined, time: boolean) => {
  if (!value) return undefined
  try {
    return time ? parseDateTime(value.slice(0, 16)) : parseDate(value.slice(0, 10))
  } catch {
    return undefined
  }
}

export const formatDateInput = (value: DateValue | null | undefined, time: boolean) => {
  if (!value) return ''
  return time ? toCalendarDateTime(value).toString().slice(0, 16) : value.toString().slice(0, 10)
}
