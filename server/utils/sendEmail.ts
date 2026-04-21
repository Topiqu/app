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

export const getEmailTemplate = async (id: string): Promise<string> => {
  if (!templateCache.has(id)) {
    try {
      const item = await useStorage('assets:emails:templates').getItem(`${id}.mjml`)
      if (!item) throw createError(`Email template "${id}" not found in storage`)

      let template = ''

      if (typeof item === 'string') {
        if (item.startsWith('60,109,106') || item.startsWith('60, 109, 106')) {
          const charArray = item.split(',').map((c) => parseInt(c.trim(), 10))
          template = new TextDecoder().decode(new Uint8Array(charArray))
        } else {
          template = item
        }
      } else if (item instanceof Uint8Array || Array.isArray(item)) {
        template = new TextDecoder().decode(new Uint8Array(item as any))
      } else if (typeof item === 'object' && item !== null && 'data' in item && Array.isArray((item as any).data)) {
        template = new TextDecoder().decode(new Uint8Array((item as any).data))
      } else {
        template = String(item)
      }

      templateCache.set(id, template)
    } catch (error) {
      throw createError(`An error occured while trying to get email template "${id}": ${error}`)
    }
  }
  return templateCache.get(id) as string
}

export const sendEmail = async ({ event, to, template, data, lang: forcedLang }: EmailData) => {
  const lang = forcedLang ?? (event ? (getCookie(event, 'i18n_lang') as Language | undefined) : undefined) ?? 'en'

  const messages = await getEmailLocaleMessages(lang)
  if (!messages) throw createError(`Email locale messages for "${lang}" not found`)

  const mjmlTemplate = await getEmailTemplate(template)

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

  let parsedMjml = mjmlTemplate

  for (const [k, v] of Object.entries(data)) {
    parsedMjml = parsedMjml.replace(new RegExp(`{\\s*${k}\\s*}`, 'g'), v)
  }
  parsedMjml = parsedMjml.replace(/\{t:([^}]+)\}/g, (_, key: string) => translate(key, data))

  let finalHtml = ''
  try {
    const { html: rawHtml, errors } = mjml2html(parsedMjml, {
      validationLevel: 'soft',
    })

    if (errors.length) {
      console.warn('[MJML Validation Warnings]:', errors)
    }

    finalHtml = rawHtml
  } catch (error) {
    console.error('================ FATAL MJML ERROR ================')
    console.error('CHYBA:', error)
    console.error('--- CO SE PŘESNĚ POSLALO DO KOMPILÁTORU: ---')
    console.error(parsedMjml)
    console.error('==================================================')
    throw createError('MJML compilation failed due to a syntax or parser error.')
  }

  const config = useRuntimeConfig()
  const client = getSesClient()

  const command = new SendEmailCommand({
    Source: config.email.from,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: {
        Data: translate(`${template}.subject`, data),
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: finalHtml,
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
