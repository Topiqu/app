import { useI18n } from 'vue-i18n'

import { formatArticleDate } from './time'

export const formatDate = (d?: string | Date) => {
  const { t, locale } = useI18n()

  if (!d) return t('articles.dateFormats.justNow')

  return formatArticleDate(d, locale.value)
}
