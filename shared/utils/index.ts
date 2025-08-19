import { format, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks } from 'date-fns'

export const formatDate = (d?: string | Date) => {
  if (!d) return 'Nikdy'

  const date = new Date(d)
  const now = new Date()

  const minutesDiff = differenceInMinutes(now, date)
  const hoursDiff = differenceInHours(now, date)
  const daysDiff = differenceInDays(now, date)
  const weeksDiff = differenceInWeeks(now, date)

  if (minutesDiff < 60) {
    return `Před ${minutesDiff} minutami`
  } else if (hoursDiff < 24) {
    return `Před ${hoursDiff} hodinami`
  } else if (daysDiff === 1) {
    return 'Včera'
  } else if (daysDiff < 7) {
    return `Před ${daysDiff} dny`
  } else if (weeksDiff <= 2) {
    return `Před týdnem`
  } else {
    return format(date, 'dd.MM.yyyy, HH:mm')
  }
}
