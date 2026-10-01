import { isLanguage } from '~~/shared/utils/language'
import { SHOPIFY_INSTALL_COOKIE } from '~~/shared/utils/shopify'

import { verifyShopifyLink } from '../../utils/shopify/security'
import { SHOPIFY_LINK_COOKIE, shopifyOrigin } from '../../utils/shopify/config'

const MAX_AGE_SECONDS = 900

// Opened from App Home in a new tab. Moves the signed link out of the URL and into a cookie, so the
// project choice happens after sign-in and an explicit confirmation in integration settings.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const origin = shopifyOrigin()
  const locale = getCookie(event, 'i18n_lang')
  const settingsUrl = `${origin}/${isLanguage(locale) ? locale : 'en'}/settings?tab=integrations`
  const { code } = getQuery(event)
  const installationId = verifyShopifyLink(code)
  const installation = installationId
    ? await prisma.shopifyInstallation.findUnique({ where: { id: installationId }, select: { shop: true } })
    : null
  if (!installation) return sendRedirect(event, `${settingsUrl}&shopify=expired`)
  const secure = origin.startsWith('https:')
  setCookie(event, SHOPIFY_LINK_COOKIE, String(code), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/shopify',
    maxAge: MAX_AGE_SECONDS,
  })
  setCookie(event, SHOPIFY_INSTALL_COOKIE, installation.shop, { secure, sameSite: 'lax', path: '/', maxAge: MAX_AGE_SECONDS })
  return sendRedirect(event, `${settingsUrl}&shopify=link`)
})
