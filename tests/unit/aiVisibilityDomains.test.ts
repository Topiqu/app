import { describe, expect, it } from 'vitest'

import { promptSource, seedDue } from '../../server/utils/ai/visibilityPrompts'
import { citedDomains, interleaveByTenant, isReferenceDomain, rankDomains } from '../../shared/utils/aiVisibility'

const run = (promptId: string, ...domains: string[]) => ({
  promptId,
  citations: domains.map((domain) => ({ domain, owned: domain === 'me.cz' })),
})

describe('cited domain classification', () => {
  it('treats platforms and public bodies as sources, including their subdomains', () => {
    for (const domain of ['cs.wikipedia.org', 'reddit.com', 'mvcr.gov.cz', 'data.gov', 'service-public.gouv.fr'])
      expect(isReferenceDomain(domain), domain).toBe(true)
    for (const domain of ['rival.cz', 'notwikipedia.org', 'governance.cz'])
      expect(isReferenceDomain(domain)).toBe(false)
  })

  it('calls a domain a competitor only once it recurs across questions', () => {
    const rows = citedDomains([
      run('p1', 'rival.cz', 'once.cz', 'me.cz'),
      run('p2', 'rival.cz'),
      run('p3', 'wikipedia.org', 'rival.cz'),
      run('p3', 'wikipedia.org'),
    ])
    const byDomain = Object.fromEntries(rows.map((row) => [row.domain, row]))
    expect(byDomain['rival.cz']).toMatchObject({ kind: 'COMPETITOR', prompts: 3, runs: 3, share: 0.75 })
    expect(byDomain['once.cz']?.kind).toBe('OTHER')
    expect(byDomain['wikipedia.org']?.kind).toBe('REFERENCE')
    expect(byDomain['me.cz']).toBeUndefined()
  })

  it('counts a domain once per answer however many of its pages were cited', () => {
    const [row] = citedDomains([run('p1', 'rival.cz', 'rival.cz')])
    expect(row).toMatchObject({ runs: 1, share: 1 })
  })

  it('lets the tenant promote or hide a domain', () => {
    const marks = new Map([
      ['once.cz', 'COMPETITOR' as const],
      ['rival.cz', 'HIDDEN' as const],
    ])
    const rows = citedDomains([run('p1', 'once.cz', 'rival.cz'), run('p2', 'rival.cz')], marks)
    expect(rows).toEqual([expect.objectContaining({ domain: 'once.cz', kind: 'COMPETITOR', marked: true })])
  })

  it('ranks opportunity domains by frequency without the hidden ones', () => {
    expect(rankDomains(['b.cz', 'a.cz', 'b.cz', 'c.cz'], new Set(['c.cz']))).toEqual(['b.cz', 'a.cz'])
  })
})

describe('visibility scheduling', () => {
  it('interleaves tenants so a large prompt set cannot starve the others', () => {
    const prompts = [
      { id: 'a1', clientSiteId: 'a' },
      { id: 'a2', clientSiteId: 'a' },
      { id: 'a3', clientSiteId: 'a' },
      { id: 'b1', clientSiteId: 'b' },
    ]
    expect(interleaveByTenant(prompts).map((prompt) => prompt.id)).toEqual(['a1', 'b1', 'a2', 'a3'])
  })

  it('maps generated refs to prompt sources', () => {
    expect(promptSource('Q3')).toBe('SEARCH_CONSOLE')
    expect(promptSource('a1')).toBe('ARTICLE')
    expect(promptSource('C2')).toBe('COMMENT')
    expect(promptSource('SITE')).toBe('GENERATED')
  })

  it('reseeds a tenant weekly', () => {
    const now = new Date('2026-09-27T05:00:00Z')
    expect(seedDue(null, now)).toBe(true)
    expect(seedDue(new Date('2026-09-22T05:00:00Z'), now)).toBe(false)
    expect(seedDue(new Date('2026-09-20T05:00:00Z'), now)).toBe(true)
  })
})
