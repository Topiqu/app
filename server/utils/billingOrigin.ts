import type { H3Event } from 'h3'

/** Return URLs are same-origin navigation, never a client-selected external redirect. */
export const billingReturnOrigin = async (event: H3Event, supplied: unknown) => {
  const expected = getRequestURL(event).origin
  try {
    if (typeof supplied === 'string' && new URL(supplied).origin === expected) return expected
  } catch {
    /* invalid input */
  }
  const { translate: t } = await useServerI18n(event)
  throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
}
