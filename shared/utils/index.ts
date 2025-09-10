import { useI18n } from 'vue-i18n'
import { enUS, cs } from 'date-fns/locale'
import {
  format,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  isThisYear,
} from 'date-fns'

export const formatDate = (d?: string | Date) => {
  const { t, locale } = useI18n()
  const dateLocale = locale.value === 'en' ? enUS : cs
  const dateFormat = locale.value === 'en' ? 'MMM d, HH:mm' : 'd. MMMM, HH:mm'
  const fullDateFormat = locale.value === 'en' ? 'MMM d, yyyy, HH:mm' : 'd. MMMM yyyy, HH:mm'

  if (!d) return t('articles.dateFormats.justNow')

  const date = new Date(d)
  const now = new Date()

  const minutesDiff = differenceInMinutes(now, date)
  const hoursDiff = differenceInHours(now, date)
  const daysDiff = differenceInDays(now, date)
  const weeksDiff = differenceInWeeks(now, date)

  if (minutesDiff == 0 || minutesDiff == 1) {
    return t('articles.dateFormats.justNow')
  } else if (minutesDiff < 60) {
    return t('articles.dateFormats.minutesAgo', [minutesDiff])
  } else if (hoursDiff < 24) {
    return t('articles.dateFormats.hoursAgo', [hoursDiff])
  } else if (daysDiff === 1) {
    return t('articles.dateFormats.yesterday', [format(date, 'HH:mm', { locale: dateLocale })])
  } else if (daysDiff < 7) {
    return t('articles.dateFormats.daysAgo', [daysDiff])
  } else if (weeksDiff <= 2) {
    return t('articles.dateFormats.weekAgo')
  } else if (isThisYear(date)) {
    return format(date, dateFormat, { locale: dateLocale })
  } else {
    return format(date, fullDateFormat, { locale: dateLocale })
  }
}
