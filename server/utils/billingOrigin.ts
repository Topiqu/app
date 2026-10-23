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

/** Older clients omit locale; their existing locale cookie/account preference remains authoritative. */
export const billingReturnUrl = async (
  event: H3Event,
  origin: unknown,
  suppliedLocale?: unknown,
  accountLocale?: unknown,
) => {
  const returnOrigin = await billingReturnOrigin(event, origin)
  if (suppliedLocale !== undefined && !isLanguage(suppliedLocale)) {
    const { translate: t } = await useServerI18n(event)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  }
  const cookieLocale = getCookie(event, 'i18n_lang')
  const locale = isLanguage(suppliedLocale)
    ? suppliedLocale
    : isLanguage(cookieLocale)
      ? cookieLocale
      : isLanguage(accountLocale)
        ? accountLocale
        : 'en'
  return `${returnOrigin}${homePath(locale)}/settings?tab=billing`
}
