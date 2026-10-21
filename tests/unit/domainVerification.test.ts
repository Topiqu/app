import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkDomainDns, evaluateDomainDns, nextReverificationState } from '../../server/utils/domainVerification'

describe('domain DNS verification', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('parses DNS JSON responses through ofetch before evaluating records', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const answer =
        url.searchParams.get('type') === 'TXT'
          ? { type: 16, data: '"topiqu-verification=fixture"' }
          : { type: 5, data: 'domains.topiqu.com.' }
      return new Response(JSON.stringify({ Status: 0, Answer: [answer] }), {
        headers: { 'content-type': 'application/dns-json' },
      })
    })
    vi.stubGlobal('fetch', fetch)

    await expect(checkDomainDns('publication.example', 'fixture')).resolves.toMatchObject({
      ownershipVerified: true,
      routingVerified: true,
      dnsStatus: { txt: 0, cname: 0 },
      error: null,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('requires an exact TXT challenge and exact normalized CNAME target', () => {
    const result = evaluateDomainDns(
      { Status: 0, Answer: [{ type: 16, data: '"topiqu-verification=secret"' }] },
      { Status: 0, Answer: [{ type: 5, data: 'domains.topiqu.com.' }] },
      'secret',
      'domains.topiqu.com',
    )
    expect(result.ownershipVerified).toBe(true)
    expect(result.routingVerified).toBe(true)
  })

  it('rejects suffix and substring attacks', () => {
    const result = evaluateDomainDns(
      { Status: 0, Answer: [{ type: 16, data: '"topiqu-verification=secret-extra"' }] },
      { Status: 0, Answer: [{ type: 5, data: 'domains.topiqu.com.attacker.example.' }] },
      'secret',
      'domains.topiqu.com',
    )
    expect(result.ownershipVerified).toBe(false)
    expect(result.routingVerified).toBe(false)
  })

  it('does not treat records of another type as valid', () => {
    const result = evaluateDomainDns(
      { Status: 0, Answer: [{ type: 5, data: 'topiqu-verification=secret' }] },
      { Status: 0, Answer: [{ type: 1, data: 'domains.topiqu.com' }] },
      'secret',
    )
    expect(result.ownershipVerified).toBe(false)
    expect(result.routingVerified).toBe(false)
  })

  it('degrades after repeated failures and revokes only after the grace period', () => {
    const now = new Date('2026-08-09T00:00:00Z')
    const degraded = nextReverificationState({ failures: 2, status: 'VERIFIED', degradedAt: null, now })
    expect(degraded).toMatchObject({ failures: 3, status: 'DEGRADED', domainVerified: true })

    const revoked = nextReverificationState({
      failures: degraded.failures,
      status: 'DEGRADED',
      degradedAt: degraded.degradedAt,
      now: new Date('2026-08-16T00:00:01Z'),
    })
    expect(revoked).toMatchObject({ status: 'FAILED', domainVerified: false })
  })
})
