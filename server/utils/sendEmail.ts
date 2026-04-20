import type { H3Event } from 'h3'

import mjml2html from 'mjml'
import { getCookie } from 'h3'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

interface EmailData {
  event?: H3Event
  to: string
  lang?: Language
  template: string
  data: Record<string, string>
}

const messageCache = new Map<Language, any>()
const templateCache = new Map<string, string>()

type Messages = ReturnType<(typeof messageCache)['get']>
type Templates = ReturnType<(typeof templateCache)['get']>

let sesClient: SESClient | null = null

const getSesClient = () => {
  if (!sesClient) {
    const config = useRuntimeConfig()
    sesClient = new SESClient({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    })
  }
  return sesClient
}

export const getEmailLocaleMessages = async (locale: Language): Promise<Messages> => {
  if (!messageCache.has(locale)) {
    try {
      const messages = await useStorage('assets:emails:locales').getItem(`${locale}.json`)
      messageCache.set(locale, messages)
    } catch {
      const fallback = await useStorage('assets:emails:locales').getItem(`en.json`)
      messageCache.set(locale, fallback)
    }
  }
  return messageCache.get(locale)
}

export const getEmailTemplate = async (id: string): Promise<Templates> => {
  if (!templateCache.has(id)) {
    try {
      const template = await useStorage('assets:emails:templates').getItem(`${id}.mjml`)
      if (!template) throw createError(`Email template "${id}" not found in storage`)
      templateCache.set(id, template.toString())
    } catch (error) {
      throw createError(`An error occured while trying to get email template "${id}": ${error}`)
    }
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
  for (const [k, v] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{\\s*${k}\\s*}`, 'g'), v)
  }

  rendered = rendered.replace(/\{t:([^}]+)\}/g, (_, key: string) => translate(key, data))

  const { html, errors } = mjml2html(rendered)
  if (errors.length) throw createError('MJML compilation failed')

  const config = useRuntimeConfig()
  const client = getSesClient()

  const command = new SendEmailCommand({
    Source: config.email.from,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: translate(`${template}.subject`, data),
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },
        Text: {
          Data: translate(`${template}.intro`, data).replace(/<[^>]+>/g, ''),
          Charset: 'UTF-8',
        },
      },
    },
  })

  try {
    await client.send(command)
  } catch (error) {
    console.error('[SES Email Error]:', error)
    throw createError(`Failed to send email via SES: ${error}`)
  }
}
