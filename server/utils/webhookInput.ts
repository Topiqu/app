import { z } from 'zod'
import { assertPublicHttpsUrl } from '~~/server/utils/images/publicFetch'
import { WEBHOOK_EVENTS, webhookUrlError } from '~~/shared/utils/webhooks'

export const webhookUrlSchema = z
  .string()
  .trim()
  .refine((url) => !webhookUrlError(url), 'Webhook URL must be a public HTTPS address')

export const webhookEventsSchema = z
  .array(z.enum(WEBHOOK_EVENTS))
  .min(1)
  .max(WEBHOOK_EVENTS.length)
  .transform((events) => [...new Set(events)])

/** The shape check cannot see where a hostname resolves; a name pointing at 10.0.0.1 passes it. */
export const assertPublicWebhookUrl = async (url: string) => {
  try {
    await assertPublicHttpsUrl(url)
  } catch {
    throw createError({ statusCode: 400, message: 'Webhook URL must resolve to a public address' })
  }
}
