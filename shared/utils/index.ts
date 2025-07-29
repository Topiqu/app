import { format } from 'date-fns'

export const formatDate = (d?: string | Date) => (d ? format(new Date(d), 'dd.MM.yyyy, HH:mm') : 'Nikdy')
