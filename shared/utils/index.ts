import { formatArticleDate } from './time'

export const formatDate = (d?: string | Date | null, locale = 'cs') => (d ? formatArticleDate(d, locale) : '')
