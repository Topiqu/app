import type { H3Event } from 'h3'

import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'

type Locale = 'cs' | 'en' | ({} & string)

const messageCache = new Map<Locale, any>()
type Messages = any

const localesDir = resolve(process.cwd(), 'i18n/locales')

export const getServerLocaleMessages = async (locale: Locale): Promise<Messages> => {
  if (messageCache.has(locale)) return messageCache.get(locale)

  const filePath = resolve(localesDir, `${locale.toLowerCase()}.json`)
  let raw: string

  try {
    raw = await readFile(filePath, 'utf-8')
  } catch {
    raw = await readFile(resolve(localesDir, 'en.json'), 'utf-8')
  }

  let messages
  try {
    messages = JSON.parse(raw)
  } catch {
    const enRaw = await readFile(resolve(localesDir, 'en.json'), 'utf-8')
    messages = JSON.parse(enRaw)
  }

  messageCache.set(locale, messages)
  return messages
}

export const useServerI18n = async (
  event: H3Event,
  opts: {
    locale?: Locale
    messages?: Messages
  } = {},
) => {
  const locale: Locale = opts.locale || getCookie(event, 'i18n_lang') || 'en'
  const messages: Messages = opts.messages || (await getServerLocaleMessages(locale))

  const translate = (key: string, params?: Record<string, any>) => {
    const template = key.split('.').reduce((o, k) => o?.[k], messages) as string
    if (!template) return key
    return params ? template.replace(/{(\w+)}/g, (_, k) => params[k]?.toString() ?? _) : template
  }

  return { translate }
}
