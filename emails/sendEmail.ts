import { join } from 'path'
import mjml2html from 'mjml'
import { readFile } from 'fs/promises'

interface EmailData {
  to: string
  lang: 'cs' | 'en'
  template: string
  data: Record<string, string>
}

export async function sendEmail({ to, lang = 'en', template, data }: EmailData) {
  const localePath = join(process.cwd(), 'emails/locales', `${lang}.json`)
  const messages = JSON.parse(await readFile(localePath, 'utf-8'))

  const translate = (key: string, params?: Record<string, string>) => {
    const template = key.split('.').reduce((obj, k) => obj?.[k], messages) as string
    if (!template) {
      console.warn(`Translation key "${key}" not found for locale "${lang}"`)
      return key
    }
    return params ? template.replace(/{(\w+)}/g, (_, k) => params[k] || k) : template
  }

  const templatePath = join(process.cwd(), 'emails/templates', `${template}.mjml`)
  let mjmlTemplate = await readFile(templatePath, 'utf-8')

  mjmlTemplate = mjmlTemplate.replace(/\{([^}]+)\}/g, (_, key) => translate(key, data))

  for (const [key, value] of Object.entries(data)) {
    mjmlTemplate = mjmlTemplate.replace(new RegExp(`{\\s*${key}\\s*}`, 'g'), value)
  }

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
