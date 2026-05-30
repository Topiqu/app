import type { H3Event } from 'h3'

type Locale = 'cs' | 'en' | ({} & string)

const messageCache = new Map<Locale, any>()

type Messages = ReturnType<(typeof messageCache)['get']>

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const deepMerge = (target: Record<string, any>, source: Record<string, any>) => {
  for (const key of Object.keys(source)) {
    const next = source[key]
    target[key] = isPlainObject(next) && isPlainObject(target[key]) ? deepMerge(target[key], next) : next
  }
  return target
}

const loadLocaleMessages = async (locale: Locale): Promise<Messages> => {
  const storage = useStorage('assets:i18n:locales')
  const keys = await storage.getKeys()
  const localeKeys = keys.filter((key) => key.startsWith(`${locale}:`) || key === `master_${locale}.json`)

  const merged: Record<string, any> = {}
  for (const key of localeKeys) {
    const part = (await storage.getItem(key)) as Record<string, any> | null
    if (isPlainObject(part)) deepMerge(merged, part)
  }

  return merged
}

export const getServerLocaleMessages = async (locale: Locale): Promise<Messages> => {
  if (!messageCache.has(locale)) {
    let messages = await loadLocaleMessages(locale)
    if (!Object.keys(messages).length && locale !== 'en') messages = await loadLocaleMessages('en')
    messageCache.set(locale, messages)
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
