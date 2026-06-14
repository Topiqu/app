export function useTime() {
  const { locale } = useI18n()

  const formatTime = (
    date: Date | string | number,
    preset: TimeAbsolutePreset = 'datetime',
    localeOverride?: string,
  ) => new Intl.DateTimeFormat(localeOverride ?? locale.value, TIME_PRESETS[preset]).format(new Date(date))

  return { formatTime }
}
