export const TIME_PRESETS = {
  date: { day: 'numeric', month: 'long', year: 'numeric' },
  datetime: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  short: { day: 'numeric', month: 'numeric', year: 'numeric' },
  shortDatetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

export type TimeAbsolutePreset = keyof typeof TIME_PRESETS

export type TimePreset = TimeAbsolutePreset | 'relative'
