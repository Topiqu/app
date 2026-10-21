import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import {
  decryptDomainCertificate,
  encryptDomainCertificate,
  validateDomainCertificate,
  verifyDomainCertificate,
} from '../../server/utils/domains/certificates'

const directory = mkdtempSync(join(tmpdir(), 'topiqu-certificate-fixture-'))
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '3',
    '-subj',
    '/CN=blog.example.com',
    '-addext',
    'subjectAltName=DNS:blog.example.com',
    '-addext',
    'basicConstraints=critical,CA:FALSE',
    '-keyout',
    join(directory, 'key.pem'),
    '-out',
    join(directory, 'certificate.pem'),
  ],
  { stdio: 'ignore' },
)
const certificate = readFileSync(join(directory, 'certificate.pem'), 'utf8')
const privateKey = readFileSync(join(directory, 'key.pem'), 'utf8')
afterAll(() => rmSync(directory, { recursive: true }))
afterEach(() => vi.unstubAllEnvs())

describe('origin certificate validation', () => {
  it('verifies the server certificate purpose and full path with OpenSSL', async () => {
    await expect(
      verifyDomainCertificate('blog.example.com', certificate, privateKey, new Date(), [certificate]),
    ).resolves.toMatchObject({ fingerprint: expect.any(String) })
  })
  it('accepts a matching, current hostname certificate and key', () => {
    expect(
      validateDomainCertificate('blog.example.com', certificate, privateKey, new Date(), [certificate]).fingerprint,
    ).toMatch(/^[A-F0-9:]+$/)
  })
  it('rejects another hostname, malformed keys and expired certificates', () => {
    expect(() => validateDomainCertificate('another.example.com', certificate, privateKey)).toThrow(
      'CERTIFICATE_INVALID',
    )
    expect(() => validateDomainCertificate('blog.example.com', certificate, 'invalid')).toThrow('CERTIFICATE_INVALID')
    expect(() =>
      validateDomainCertificate('blog.example.com', certificate, privateKey, new Date('2100-01-01')),
    ).toThrow('CERTIFICATE_INVALID')
  })
  it('rejects self-signed certificates outside the trusted CA store', () => {
    expect(() => validateDomainCertificate('blog.example.com', certificate, privateKey)).toThrow('CERTIFICATE_INVALID')
  })
  it('does not include PEM material in validation errors', () => {
    expect(() => validateDomainCertificate('blog.example.com', 'secret-fixture', privateKey)).toThrow(
      /^CERTIFICATE_INVALID$/,
    )
  })
  it('binds encrypted material to the connection and detects tampering', () => {
    vi.stubEnv('DOMAIN_SECRETS_ENCRYPTION_KEY', Buffer.alloc(32, 42).toString('base64'))
    const encrypted = encryptDomainCertificate('synthetic-private-material', 'connection-a')
    expect(encrypted).not.toContain('synthetic-private-material')
    expect(decryptDomainCertificate(encrypted, 'connection-a')).toBe('synthetic-private-material')
    expect(() => decryptDomainCertificate(encrypted, 'connection-b')).toThrow()
    const parts = encrypted.split('.')
    parts[1] = Buffer.alloc(16).toString('base64url')
    expect(() => decryptDomainCertificate(parts.join('.'), 'connection-a')).toThrow()
  })
})
