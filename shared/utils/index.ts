import { format } from 'date-fns'
import { useI18n } from 'vue-i18n'
import { enUS, cs } from 'date-fns/locale'

export const formatDate = (d?: string | Date) => {
  const { t, locale } = useI18n()
  const dateLocale = locale.value === 'en' ? enUS : cs
  const fullDateFormat = locale.value === 'en' ? 'MMM d, yyyy, HH:mm' : 'd. MMMM yyyy, HH:mm'

  if (!d) return t('articles.dateFormats.justNow')

  const date = new Date(d)
  return format(date, fullDateFormat, { locale: dateLocale })
}
