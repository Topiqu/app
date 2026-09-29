import { describe, expect, it } from 'vitest'

import { clientIp } from '../../server/utils/ip'

const edge = '172.70.240.24'

describe('clientIp', () => {
  it.each([
    ['visitor behind a Cloudflare edge', { 'x-forwarded-for': edge, 'cf-connecting-ip': '203.0.113.4' }, '203.0.113.4'],
    ['IPv6 Cloudflare edge', { 'x-forwarded-for': '2606:4700::1', 'cf-connecting-ip': '2001:db8::7' }, '2001:db8::7'],
    ['edge without the header', { 'x-forwarded-for': edge }, edge],
    ['edge with a malformed header', { 'x-forwarded-for': edge, 'cf-connecting-ip': 'nope' }, edge],
    [
      'direct visitor forging the header',
      { 'x-forwarded-for': '198.51.100.9', 'cf-connecting-ip': '203.0.113.4' },
      '198.51.100.9',
    ],
    ['forged leading entries', { 'x-forwarded-for': '203.0.113.4, 198.51.100.9' }, '198.51.100.9'],
    ['no proxy', {}, null],
  ])('%s', (_, headers, expected) => {
    expect(clientIp(headers)).toBe(expected)
  })
})
