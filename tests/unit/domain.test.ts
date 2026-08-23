import { describe, expect, it } from 'vitest'

import {
  domainVerificationDefaults,
  isForeignHost,
  isManagedDomain,
  isValidDomain,
  normalizeDomain,
} from '../../shared/utils/domain'

describe('domain rules', () => {
  it('normalizes hostnames without accepting URL decoration as part of the domain', () => {
    expect(normalizeDomain('HTTPS://Blog.Example.COM./')).toBe('blog.example.com')
  })

  it('recognizes only the base domain and its real subdomains as managed', () => {
    expect(isManagedDomain('blog.topiqu.com')).toBe(true)
    expect(isManagedDomain('topiqu.com')).toBe(true)
    expect(isManagedDomain('not-topiqu.com')).toBe(false)
    expect(isManagedDomain('topiqu.com.attacker.example')).toBe(false)
  })

  it('validates label boundaries', () => {
    expect(isValidDomain('blog.example.com')).toBe(true)
    expect(isValidDomain('-blog.example.com')).toBe(false)
    expect(isValidDomain('blog..example.com')).toBe(false)
  })

  it('treats another tenant as foreign, and a tenantless root host as no conflict', () => {
    expect(isForeignHost('pixbo', 'test')).toBe(true)
    expect(isForeignHost('test', 'test')).toBe(false)
    expect(isForeignHost(null, 'test')).toBe(false)
  })

  it('keeps an admin without a tenant off every tenant host', () => {
    expect(isForeignHost('pixbo', '')).toBe(true)
    expect(isForeignHost('pixbo', undefined)).toBe(true)
  })

  it('auto-verifies managed domains and challenges custom domains', () => {
    expect(domainVerificationDefaults('tenant.topiqu.com', 'token').domainVerified).toBe(true)
    const custom = domainVerificationDefaults('blog.example.com', 'token')
    expect(custom).toMatchObject({
      domainVerified: false,
      domainVerificationStatus: 'PENDING',
      domainVerificationToken: 'token',
    })
  })
})
