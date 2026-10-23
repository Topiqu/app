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
    if (await isDomainTaken(fullDomain)) return { ok: false as const, reason: 'taken' as Reason }
    return { ok: true as const, fullDomain }
  }

  if (!isValidDomain(raw) || !raw.includes('.')) return { ok: false as const, reason: 'invalid' as Reason }
  if (isManagedDomain(raw)) return { ok: false as const, reason: 'reserved' as Reason }

  if (await isDomainTaken(raw)) return { ok: false as const, reason: 'taken' as Reason }
  return { ok: true as const, fullDomain: raw }
})
