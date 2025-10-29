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

const resolveLang = (event?: H3Event, forced?: Language): Language =>
  forced ?? (event ? (getCookie(event, 'i18n_lang') as Language | undefined) : undefined) ?? 'en'

const loadLocale = async (lang: Language) => {
  const module = await import(`../emails/locales/${lang}.json`, { assert: { type: 'json' } })

  return module.default
}

const loadTemplate = async (template: string): Promise<string> => {
  const module = await import(`../emails/templates/${template}.mjml?raw`, { assert: { type: 'text' } })

  return module.default
}

export async function sendEmail({ event, to, template, data, lang: forcedLang }: EmailData) {
  const lang = resolveLang(event, forcedLang)

  const [messages, mjmlTemplate] = await Promise.all([
    loadLocale(lang),
    loadTemplate(template).catch(() => {
      throw createError(`Template "${template}.mjml" not found`)
    }),
  ])

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
