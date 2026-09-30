import { hashShopifyState } from '../../utils/shopify/security'
import { SHOPIFY_SCOPES, shopifyCredentials, shopifyOrigin } from '../../utils/shopify/config'

export default defineEventHandler(async (event) => {
  const { state } = getQuery(event)
  if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state))
    throw createError({ statusCode: 400, message: 'Invalid Shopify authorization' })
  const attempt = await prisma.shopifyOAuthAttempt.findUnique({ where: { tokenHash: hashShopifyState(state) } })
  if (!attempt || attempt.expiresAt <= new Date())
    throw createError({ statusCode: 403, message: 'Shopify authorization expired' })
  const origin = shopifyOrigin()
  if (getRequestURL(event).host !== new URL(origin).host)
    return sendRedirect(event, `${origin}/api/shopify/authorize?state=${state}`)
  // A copied authorization link must not let another account install a store
  // into the initiating account's project.
  const user = await requireUser(event, { role: ['admin', 'superadmin'] })
  if (user.id !== attempt.userId)
    throw createError({ statusCode: 403, message: 'Shopify authorization belongs to another account' })
  await requireTenantScope(event, 'INTEGRATION_CONTROL', attempt.clientSiteId)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setCookie(event, 'shopify_oauth_state', state, {
    httpOnly: true,
    secure: origin.startsWith('https:'),
    sameSite: 'lax',
    path: '/api/shopify',
    maxAge: 600,
  })
  const { clientId } = shopifyCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: `${origin}/api/shopify/callback`,
    state,
  })
  return sendRedirect(event, `https://${attempt.shop}/admin/oauth/authorize?${params}`)
})
