import type { H3Event } from 'h3'

import { join } from 'path'
import mjml2html from 'mjml'
import { readFile } from 'fs/promises'

interface EmailData {
  event?: H3Event
  to: string
  lang?: 'cs' | 'en'
  template: string
  data: Record<string, string>
}

export async function sendEmail({ event, to, template, data, lang }: EmailData) {
  const resolvedLang = lang || (event ? (getCookie(event, 'i18n_lang') as 'cs' | 'en' | undefined) : undefined) || 'en'
  const localePath = join(process.cwd(), 'emails/locales', `${resolvedLang}.json`)
  const messages = JSON.parse(await readFile(localePath, 'utf-8'))

  const translate = (key: string, params?: Record<string, string>) => {
    const template = key.split('.').reduce((obj, k) => obj?.[k], messages) as string
    if (!template) {
      console.warn(`Translation key "${key}" not found for locale "${resolvedLang}"`)
      return key
    }
    return params ? template.replace(/{(\w+)}/g, (_, k) => params[k] || k) : template
  }

  const templatePath = join(process.cwd(), 'emails/templates', `${template}.mjml`)
  let mjmlTemplate = await readFile(templatePath, 'utf-8')

  for (const [key, value] of Object.entries(data)) {
    mjmlTemplate = mjmlTemplate.replace(new RegExp(`{\\s*${key}\\s*}`, 'g'), value)
  }

  mjmlTemplate = mjmlTemplate.replace(/\{t:([^}]+)\}/g, (_, key) => translate(key, data))

  const { html, errors } = mjml2html(mjmlTemplate)
  if (errors.length) throw new Error(JSON.stringify(errors))

  await useNodeMailer().sendMail({
    from: useRuntimeConfig().nodemailer.from,
    to,
    subject: translate(`${template}.subject`, data),
    text: translate(`${template}.intro`, data).replace(/<[^>]+>/g, ''),
    html,
  })
}
