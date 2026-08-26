export const TOPIQU_TIME_ZONE = 'Europe/Prague'

export const TIME_PRESETS = {
  date: { day: 'numeric', month: 'long', year: 'numeric', timeZone: TOPIQU_TIME_ZONE },
  datetime: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TOPIQU_TIME_ZONE,
  },
  short: { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: TOPIQU_TIME_ZONE },
  shortDatetime: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TOPIQU_TIME_ZONE,
  },
  time: { hour: '2-digit', minute: '2-digit', timeZone: TOPIQU_TIME_ZONE },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

export type TimeAbsolutePreset = keyof typeof TIME_PRESETS

export type TimePreset = TimeAbsolutePreset | 'relative'

const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((item) => item.type === type)?.value ?? ''

/** Stable SSR/client article timestamp with the legacy punctuation kept intact. */
export const formatArticleDate = (date: string | Date, locale: string) => {
  const english = locale === 'en' || locale.toLowerCase().startsWith('en-')
  const parts = new Intl.DateTimeFormat(english ? 'en-US' : 'cs-CZ', {
    day: 'numeric',
    month: english ? 'short' : 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TOPIQU_TIME_ZONE,
  }).formatToParts(new Date(date))
  const day = part(parts, 'day')
  const month = part(parts, 'month')
  const year = part(parts, 'year')
  const time = `${part(parts, 'hour')}:${part(parts, 'minute')}`

  return english ? `${month} ${day}, ${year}, ${time}` : `${day}. ${month} ${year}, ${time}`
}
