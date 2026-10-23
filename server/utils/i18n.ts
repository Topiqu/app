import type { H3Event } from 'h3'
import type { Language } from '~~/generated/zenstack/models'

type Messages = Record<string, unknown>
const messageCache = new Map<Language, Promise<Messages>>()

const serverLocale = (locale: string): Language => LANGUAGE_OPTIONS.find((candidate) => candidate === locale) ?? 'en'

const isPlainObject = (value: unknown): value is Messages =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const deepMerge = (target: Messages, source: Messages) => {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const next = source[key]
    const previous = target[key]
    target[key] = isPlainObject(next) && isPlainObject(previous) ? deepMerge(previous, next) : next
  }
  return target
}

const loadLocaleMessages = async (locale: Language): Promise<Messages> => {
  const storage = useStorage('assets:i18n:locales')
  const keys = await storage.getKeys()
  const localeKeys = keys.filter((key) => key.startsWith(`${locale}:`) || key === `master_${locale}.json`)

  const merged: Messages = {}
  for (const key of localeKeys) {
    const part: unknown = await storage.getItem(key)
    if (isPlainObject(part)) deepMerge(merged, part)
  }

  return merged
}

const getServerLocaleMessages = (locale: Language): Promise<Messages> => {
  const cached = messageCache.get(locale)
  if (cached) return cached
  const pending = loadLocaleMessages(locale)
    .then((messages) => (Object.keys(messages).length || locale === 'en' ? messages : getServerLocaleMessages('en')))
    .catch((error: unknown) => {
      if (messageCache.get(locale) === pending) messageCache.delete(locale)
      throw error
    })
  messageCache.set(locale, pending)
  return pending
}

/** The same lookup without a request behind it — background work (AI finalization, crons) has no cookie to read. */
export const getServerTranslator = async (requestedLocale: string, preloaded?: Messages) => {
  const locale = serverLocale(requestedLocale)
  const messages = preloaded ?? (await getServerLocaleMessages(locale))

  return (key: string, params?: Record<string, unknown> | unknown[]): string | undefined => {
    let template: unknown = messages
    for (const part of key.split('.')) {
      template = isPlainObject(template) && Object.hasOwn(template, part) ? template[part] : undefined
    }

    if (typeof template !== 'string' || !template) {
      console.warn(`Translation key "${key}" not found for locale "${locale}"`)
      return undefined
    }

    if (params)
      return template.replace(/{(\w+)}/g, (match, paramKey: string) => {
        let value: unknown
        if (Array.isArray(params)) {
          if (/^\d+$/.test(paramKey)) value = params[Number(paramKey)]
        } else if (Object.hasOwn(params, paramKey)) value = params[paramKey]
        return value === null || value === undefined ? match : String(value) || match
      })

    return template
  }
}

export const useServerI18n = async (
  event: H3Event,
  opts: {
    locale?: string
    messages?: Messages
  } = {},
) => {
  const locale = opts.locale || getCookie(event, 'i18n_lang') || 'en'

  return { translate: await getServerTranslator(locale, opts.messages) }
}
