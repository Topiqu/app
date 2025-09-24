import type { H3Event } from 'h3'

type Locale = 'cs' | 'en' | ({} & string)

const messageCache = new Map<Locale, any>()

type Messages = ReturnType<(typeof messageCache)['get']>

export const getServerLocaleMessages = async (locale: Locale): Promise<Messages> => {
  if (!messageCache.has(locale))
    try {
      const messages = await import(`~~/i18n/locales/${locale}.json`)
      messageCache.set(locale, messages.default)
    } catch {
      const fallback = await import('~~/i18n/locales/en.json')
      messageCache.set(locale, fallback.default)
    }

  return messageCache.get(locale)
}

export const useServerI18n = async (
  event: H3Event,
  opts: {
    locale?: Locale
    messages?: Messages
  } = {},
) => {
  const locale: Locale = opts.locale || getCookie(event, 'i18n_lang') || 'en'
  const messages: Messages = opts.messages || (await getServerLocaleMessages(locale)) || {}

  const translate = (key: string, params?: Record<string, any>) => {
    const template = key.split('.').reduce((obj, k) => obj?.[k], messages) as string

    if (!template) return console.warn(`Translation key "${key}" not found for locale "${locale}"`)

    if (params) return template.replace(/{(\w+)}/g, (match, paramKey) => params[paramKey]?.toString() || match)

    return template
  }

  return { translate }
}
