import { describe, expect, it } from 'vitest'

import { mergeDomainValidationRecords, readDomainValidationRecords } from '../../shared/utils/domainRecords'

describe('domain DNS instructions', () => {
  const first = { type: 'TXT', name: '_acme.example.test', value: 'first', purpose: 'certificate' as const }
  const second = { ...first, value: 'second' }
  it('retains replaced challenges as history without presenting them as current requirements', () => {
    expect(mergeDomainValidationRecords([first], [second])).toEqual([
      { ...second, active: true },
      { ...first, active: false },
    ])
  })
  it('keeps simultaneous TXT values with the same name and deduplicates exact matches', () => {
    expect(mergeDomainValidationRecords([first], [first, second, first])).toHaveLength(2)
    expect(mergeDomainValidationRecords([first], [first, second]).every((record) => record.active)).toBe(true)
  })
  it('retains instructions when Cloudflare stops returning them, without claiming verification', () => {
    expect(mergeDomainValidationRecords([first], [])).toEqual([{ ...first, active: false }])
  })
  it('restores a previously requested value if Cloudflare asks for it again', () => {
    expect(mergeDomainValidationRecords([{ ...first, active: false }], [first])).toEqual([{ ...first, active: true }])
  })
  it('reads legacy JSON arrays and rejects malformed entries', () => {
    expect(readDomainValidationRecords([null, {}, first, 'invalid'])).toEqual([first])
    expect(readDomainValidationRecords(null)).toEqual([])
  })
})
