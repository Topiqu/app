import { describe, expect, it } from 'vitest'

import {
  backlinkAllowance,
  backlinkTarget,
  isFollowed,
  isOwnedHost,
  mentionsTerm,
  ownedHosts,
} from '../../shared/utils/backlinks'

describe('backlinkAllowance', () => {
  it('gives Pro unlinked mentions without drafts and Premium/Custom everything', () => {
    expect(backlinkAllowance('BASIC')).toEqual({ kinds: [], drafts: false })
    expect(backlinkAllowance(null)).toEqual({ kinds: [], drafts: false })
    expect(backlinkAllowance('PRO')).toEqual({ kinds: ['UNLINKED_MENTION'], drafts: false })
    expect(backlinkAllowance('PREMIUM')).toEqual({ kinds: ['UNLINKED_MENTION', 'SUPPLIER'], drafts: true })
    expect(backlinkAllowance('CUSTOM')).toEqual({ kinds: ['UNLINKED_MENTION', 'SUPPLIER'], drafts: true })
  })
})

describe('owned hosts', () => {
  it('counts the blog and the company website, without www, paths or duplicates', () => {
    expect(ownedHosts({ domain: 'kava.topiqu.com', websiteUrl: 'https://www.kava.cz/eshop?x=1' })).toEqual([
      'kava.topiqu.com',
      'kava.cz',
    ])
    expect(ownedHosts({ domain: 'kava.cz', websiteUrl: 'kava.cz' })).toEqual(['kava.cz'])
    expect(ownedHosts({ domain: 'kava.cz', websiteUrl: null })).toEqual(['kava.cz'])
  })

  it('matches subdomains of an owned host but not look-alikes', () => {
    const owned = ['kava.cz']
    expect(isOwnedHost('www.kava.cz', owned)).toBe(true)
    expect(isOwnedHost('shop.kava.cz', owned)).toBe(true)
    expect(isOwnedHost('mojekava.cz', owned)).toBe(false)
    expect(isOwnedHost('kava.cz.evil.com', owned)).toBe(false)
  })

  it('points a link at the company website when there is one', () => {
    expect(backlinkTarget({ domain: 'kava.topiqu.com', websiteUrl: 'https://www.kava.cz/eshop' })).toBe(
      'https://kava.cz/',
    )
    expect(backlinkTarget({ domain: 'kava.topiqu.com', websiteUrl: null })).toBe('https://kava.topiqu.com/')
  })
})

describe('mentionsTerm', () => {
  it('ignores case and accents', () => {
    expect(mentionsTerm('Nakupujeme v KAVA PRAHA každý týden', 'Káva Praha')).toBe(true)
  })

  it('needs whole words, so a name inside another word does not count', () => {
    expect(mentionsTerm('Alfabeta s.r.o. dodává', 'Alfa')).toBe(false)
    expect(mentionsTerm('Recenze: Alfa, nový kávovar', 'Alfa')).toBe(true)
  })

  it('matches a domain literally, dots included', () => {
    expect(mentionsTerm('Objednáno na kava.cz včera', 'kava.cz')).toBe(true)
    expect(mentionsTerm('Objednáno na kavaxcz včera', 'kava.cz')).toBe(false)
  })
})

describe('isFollowed', () => {
  it('treats nofollow, sponsored and ugc as not passing value', () => {
    expect(isFollowed([])).toBe(true)
    expect(isFollowed(['noopener'])).toBe(true)
    expect(isFollowed(['nofollow'])).toBe(false)
    expect(isFollowed(['sponsored', 'noopener'])).toBe(false)
    expect(isFollowed(['ugc'])).toBe(false)
  })
})
