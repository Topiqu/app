import type { H3Event } from 'h3'

import { isIP } from 'node:net'
import { createHash } from 'node:crypto'

const GRAPH_URL = 'https://graph.facebook.com/v24.0'
const DEFAULT_PIXEL_ID = '3051588728517585'
// Covers a trial converting to paid; older sign-up signals are never sent.
const SIGNAL_TTL_MS = 60 * 86400000
const META_COOKIE_RE = /^fb\.\d\.\d{10,13}\.[\w-]{1,512}$/

/** The browser context Meta matches an event to an ad click by; kept on `User.metaSignals` for the first payment. */
export type MetaSignals = { at: string; fbp?: string; fbc?: string; ip?: string; userAgent?: string }

type MetaUser = { id: string; email: string }
type MetaEvent = {
  name: 'CompleteRegistration' | 'StartTrial' | 'Subscribe'
  id: string
  user: MetaUser
  signals: MetaSignals
  url: string
  value?: { amount: number; currency: string }
}

const enabled = () => Boolean(process.env.META_CAPI_TOKEN)
const hash = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
const metaCookie = (value?: string) => (value && META_COOKIE_RE.test(value) ? value : undefined)
const appUrl = () => process.env.APP_URL || 'https://app.topiqu.com'

/** The landing pixel derives the same id, so Meta counts a sign-up reported by both once. */
export const metaRegistrationId = (email: string) => `registration-${hash(email).slice(0, 40)}`

/**
 * The pixel sets `_fbp`/`_fbc` only after the visitor accepts it on topiqu.com, and declining deletes them, so
 * without either nothing is stored or sent.
 */
export const metaSignals = (input: {
  fbp?: string
  fbc?: string
  ip?: string
  userAgent?: string
}): MetaSignals | null => {
  if (!enabled()) return null
  const fbp = metaCookie(input.fbp)
  const fbc = metaCookie(input.fbc)
  if (!fbp && !fbc) return null
  return {
    at: new Date().toISOString(),
    fbp,
    fbc,
    ip: input.ip && isIP(input.ip) ? input.ip : undefined,
    userAgent: input.userAgent?.slice(0, 512) || undefined,
  }
}

/** A browser request to the app itself; the cookies live on the registrable domain. */
export const requestMetaSignals = (event: H3Event) =>
  enabled()
    ? metaSignals({
        fbp: getCookie(event, '_fbp'),
        fbc: getCookie(event, '_fbc'),
        ip: getIp(event),
        userAgent: getHeader(event, 'user-agent'),
      })
    : null

/** The landing's signed onboarding request, which forwards the visitor's cookies as headers. */
export const landingMetaSignals = (event: H3Event) => {
  const ip = enabled() ? landingClientIp(event) : null
  return ip
    ? metaSignals({
        fbp: getHeader(event, 'x-landing-fbp'),
        fbc: getHeader(event, 'x-landing-fbc'),
        ip,
        userAgent: getHeader(event, 'x-landing-user-agent'),
      })
    : null
}

/** Never throws: a lost conversion must not fail a sign-up or a webhook. */
export const sendMetaEvent = async ({ name, id, user, signals, url, value }: MetaEvent) => {
  const token = process.env.META_CAPI_TOKEN
  if (!token) return false
  try {
    const body: Record<string, unknown> = {
      access_token: token,
      ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
      data: [
        {
          event_name: name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: id,
          // Meta requires a user agent on website events; without one a renewal-style charge is system generated.
          action_source: signals.userAgent ? 'website' : 'system_generated',
          event_source_url: url,
          user_data: {
            em: [hash(user.email)],
            external_id: [hash(user.id)],
            client_ip_address: signals.ip,
            client_user_agent: signals.userAgent,
            fbp: signals.fbp,
            fbc: signals.fbc,
          },
          ...(value ? { custom_data: { value: value.amount, currency: value.currency.toUpperCase() } } : {}),
        },
      ],
    }
    const endpoint = `${GRAPH_URL}/${process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID}/events`
    await $fetch<unknown, string>(endpoint, { method: 'POST', timeout: 5000, retry: 0, body })
    return true
  } catch (error) {
    await logger.warn('meta:event failed', {
      source: 'meta',
      event: name,
      error: (error as { data?: { error?: { message?: string } } })?.data?.error?.message ?? String(error),
    })
    return false
  }
}

/** Keeps the sign-up's signals for its first payment and reports the sign-up, and the trial when one started. */
export const reportMetaSignUp = async (
  user: MetaUser,
  signals: MetaSignals | null,
  { url, trial = false }: { url: string; trial?: boolean },
) => {
  if (!signals) return
  try {
    await prisma.user.update({ where: { id: user.id }, data: { metaSignals: signals } })
  } catch (error) {
    await logger.warn('meta:signals not stored', { source: 'meta', error: String(error) })
  }
  await sendMetaEvent({ name: 'CompleteRegistration', id: metaRegistrationId(user.email), user, signals, url })
  if (trial) await sendMetaEvent({ name: 'StartTrial', id: `trial-${user.id}`, user, signals, url })
}

/** Readers of tenant blogs register through the same endpoint; only a sign-up on the platform is a customer. */
export const reportPlatformSignUp = (event: H3Event, user: MetaUser) => {
  if (!enabled()) return
  const url = getRequestURL(event)
  if (isRootHost(url.hostname, process.env.BASE_DOMAIN || 'topiqu.com'))
    void reportMetaSignUp(user, requestMetaSignals(event), { url: `${url.origin}/auth` })
}

/** The first payment of a blog or an agency, reported for its owner while the owner's sign-up is recent. */
export const reportMetaSubscribe = async (
  payer: { clientSiteId: string } | { accountId: string },
  value?: { amount: number; currency: string },
) => {
  if (!enabled()) return
  const select = { user: { select: { id: true, email: true, metaSignals: true } } } as const
  try {
    const owner =
      'clientSiteId' in payer
        ? await prisma.tenantMembership.findFirst({
            where: { clientSiteId: payer.clientSiteId, role: 'OWNER', deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select,
          })
        : await prisma.billingAccountMember.findFirst({
            where: { accountId: payer.accountId, role: 'OWNER', deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select,
          })
    const signals = owner?.user.metaSignals as MetaSignals | null | undefined
    if (!owner || !signals || !(Date.now() - Date.parse(signals.at) <= SIGNAL_TTL_MS)) return
    const key = 'clientSiteId' in payer ? `blog-${payer.clientSiteId}` : `agency-${payer.accountId}`
    await sendMetaEvent({ name: 'Subscribe', id: `subscribe-${key}`, user: owner.user, signals, url: appUrl(), value })
  } catch (error) {
    await logger.warn('meta:subscribe failed', { source: 'meta', error: String(error) })
  }
}
