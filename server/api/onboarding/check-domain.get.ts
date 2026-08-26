import { isManagedDomain, isValidDomain, validateSubdomain } from '~~/shared/utils/domain'

type Reason = 'empty' | 'tooShort' | 'invalid' | 'reserved' | 'taken'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const baseDomain = String(useRuntimeConfig(event).public.baseDomain || 'topiqu.com')
  const raw = String(query.domain ?? '')
    .trim()
    .toLowerCase()
  const type = query.type === 'CUSTOM' ? 'CUSTOM' : 'SUBDOMAIN'

  if (!raw) return { ok: false as const, reason: 'empty' as Reason }

  if (type === 'SUBDOMAIN') {
    const reason = validateSubdomain(raw)
    if (reason) return { ok: false as const, reason: reason as Reason }

    const fullDomain = `${raw}.${baseDomain}`
    const existing = await prisma.clientSite.findUnique({ where: { domain: fullDomain }, select: { id: true } })
    if (existing) return { ok: false as const, reason: 'taken' as Reason }
    return { ok: true as const, fullDomain }
  }

  if (!isValidDomain(raw) || !raw.includes('.')) return { ok: false as const, reason: 'invalid' as Reason }
  if (isManagedDomain(raw)) return { ok: false as const, reason: 'reserved' as Reason }

  const existing = await prisma.clientSite.findUnique({ where: { domain: raw }, select: { id: true } })
  if (existing) return { ok: false as const, reason: 'taken' as Reason }
  return { ok: true as const, fullDomain: raw }
})
