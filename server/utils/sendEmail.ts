import type { H3Event } from 'h3'

import mjml2html from 'mjml'
import { getCookie } from 'h3'

interface EmailData {
  event?: H3Event
  to: string
  lang?: Language
  template: string
  data: Record<string, string>
}

const messageCache = new Map<Language, any>()

type Messages = ReturnType<(typeof messageCache)['get']>

export const getEmailLocaleMessages = async (locale: Language): Promise<Messages> => {
  if (!messageCache.has(locale))
    try {
      const messages = await import(`~~/emails/locales/${locale}.json`)
      messageCache.set(locale, messages.default)
    } catch {
      const fallback = await import('~~/emails/locales/en.json')
      messageCache.set(locale, fallback.default)
    }

  return messageCache.get(locale)
}

const templateCache = new Map<string, string>()

type Templates = ReturnType<(typeof templateCache)['get']>

export const getEmailTemplate = async (id: string): Promise<Templates> => {
  if (!templateCache.has(id))
    try {
      const template = await import(`~~/emails/templates/${id}.mjml`)
      templateCache.set(id, template.default)
    } catch (error) {
      throw createError(`An error occured while trying to get email template "${id}": ${error}`)
    }

  return templateCache.get(id)
}

export const sendEmail = async ({ event, to, template, data, lang: forcedLang }: EmailData) => {
  const lang = forcedLang ?? (event ? (getCookie(event, 'i18n_lang') as Language | undefined) : undefined) ?? 'en'

  const messages = await getEmailLocaleMessages(lang)
  if (!messages) throw createError(`Email locale messages for "${lang}" not found`)

  const mjmlTemplate = await getEmailTemplate(template)
  if (!mjmlTemplate) throw createError(`Email template "${template}" not found`)

  const translate = (key: string, params?: Record<string, string>): string => {
    const path = key.split('.')
    let value: any = messages
    for (const segment of path) {
      value = value?.[segment]
      if (value === undefined) break
    }

    const str = typeof value === 'string' ? value : ''
    if (!str) return key

    return params ? str.replace(/{(\w+)}/g, (_, k) => params[k] ?? `{${k}}`) : str
  }

  let rendered = mjmlTemplate
  for (const [k, v] of Object.entries(data)) rendered = rendered.replace(new RegExp(`{\\s*${k}\\s*}`, 'g'), v)

  rendered = rendered.replace(/\{t:([^}]+)\}/g, (_, key: string) => translate(key, data))

  const { html, errors } = mjml2html(rendered)
  if (errors.length) throw createError('MJML compilation failed')

  await useNodeMailer().sendMail({
    from: useRuntimeConfig().nodemailer.from,
    to,
    subject: translate(`${template}.subject`, data),
    text: translate(`${template}.intro`, data).replace(/<[^>]+>/g, ''),
    html,
  })
}
