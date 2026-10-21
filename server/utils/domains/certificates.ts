import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { rootCertificates } from 'node:tls'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises'
import {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

import { DomainProviderError } from './providers'

const encryptionKey = () => {
  const key = Buffer.from(process.env.DOMAIN_SECRETS_ENCRYPTION_KEY || '', 'base64')
  if (key.length !== 32) throw new DomainProviderError('CONFIGURATION')
  return key
}

export const encryptDomainCertificate = (value: string, connectionId: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(connectionId))
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.')
}

export const decryptDomainCertificate = (value: string, connectionId: string) => {
  const parts = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (parts.length !== 3 || parts[0]?.length !== 12 || parts[1]?.length !== 16)
    throw new DomainProviderError('CERTIFICATE_INVALID')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), parts[0])
  decipher.setAAD(Buffer.from(connectionId))
  decipher.setAuthTag(parts[1])
  return Buffer.concat([decipher.update(parts[2]!), decipher.final()]).toString('utf8')
}

export const validateDomainCertificate = (
  host: string,
  certificate: string,
  privateKey: string,
  now = new Date(),
  trustAnchors: readonly string[] = rootCertificates,
) => {
  try {
    if (certificate.length > 65536 || privateKey.length > 16384 || /ENCRYPTED PRIVATE KEY/.test(privateKey))
      throw new Error()
    const blocks = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)
    if (
      !blocks?.length ||
      blocks.length > 8 ||
      certificate.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()
    )
      throw new Error()
    const chain = blocks.map((block) => new X509Certificate(block))
    const leaf = chain[0]!
    if (leaf.ca || !leaf.checkHost(host, { subject: 'never' })) throw new Error()
    // Traefik's certificate store is shared. Do not install a tenant key covering other tenants' names.
    if (leaf.subjectAltName?.toLowerCase() !== `dns:${host.toLowerCase()}`) throw new Error()
    for (const cert of chain) {
      if (
        new Date(cert.validFrom).getTime() > now.getTime() ||
        new Date(cert.validTo).getTime() <= now.getTime() + 86400000
      )
        throw new Error()
    }
    for (let i = 0; i < chain.length - 1; i++) {
      if (!chain[i + 1]!.ca || !chain[i]!.checkIssued(chain[i + 1]!) || !chain[i]!.verify(chain[i + 1]!.publicKey))
        throw new Error()
    }
    const tail = chain.at(-1)!
    if (
      !trustAnchors.some((pem) => {
        const root = new X509Certificate(pem)
        return tail.fingerprint256 === root.fingerprint256 || (tail.checkIssued(root) && tail.verify(root.publicKey))
      })
    )
      throw new Error()
    const key = createPrivateKey(privateKey)
    const publicKey = createPublicKey(key).export({ type: 'spki', format: 'der' })
    if (!publicKey.equals(leaf.publicKey.export({ type: 'spki', format: 'der' }))) throw new Error()
    if (key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error()
    if (key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) > 8192) throw new Error()
    if (
      key.asymmetricKeyType === 'ec' &&
      !['prime256v1', 'secp384r1', 'secp521r1'].includes(key.asymmetricKeyDetails?.namedCurve ?? '')
    )
      throw new Error()
    if (!['rsa', 'ec', 'ed25519'].includes(key.asymmetricKeyType ?? '')) throw new Error()
    return { expiresAt: new Date(leaf.validTo), fingerprint: leaf.fingerprint256 }
  } catch {
    throw new DomainProviderError('CERTIFICATE_INVALID')
  }
}

/** OpenSSL also verifies path constraints, certificate purposes and hostname rules.
 * Only public certificates go to temporary files; private keys never leave process memory. */
export const verifyDomainCertificate = async (
  host: string,
  certificate: string,
  privateKey: string,
  now = new Date(),
  trustAnchors: readonly string[] = rootCertificates,
) => {
  const metadata = validateDomainCertificate(host, certificate, privateKey, now, trustAnchors)
  const directory = await mkdtemp(join(tmpdir(), 'topiqu-origin-chain-'))
  const leaf = join(directory, 'leaf.pem')
  const chain = join(directory, 'chain.pem')
  const roots = join(directory, 'roots.pem')
  try {
    const blocks = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!
    await writeFile(leaf, blocks[0]!, { mode: 0o600 })
    await writeFile(roots, trustAnchors.join('\n'), { mode: 0o600 })
    const args = [
      'verify',
      '-purpose',
      'sslserver',
      '-verify_hostname',
      host,
      '-attime',
      String(Math.floor(now.getTime() / 1000)),
      '-CAfile',
      roots,
    ]
    if (blocks.length > 1) {
      await writeFile(chain, blocks.slice(1).join('\n'), { mode: 0o600 })
      args.push('-untrusted', chain)
    }
    await promisify(execFile)('openssl', [...args, leaf], {
      timeout: 5000,
      maxBuffer: 4096,
      env: { PATH: process.env.PATH },
    })
    return metadata
  } catch {
    throw new DomainProviderError('CERTIFICATE_INVALID')
  } finally {
    for (const path of [leaf, chain, roots]) {
      try {
        await unlink(path)
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT')
          await reportCaughtError('Temporary certificate cleanup failed', new Error('CERTIFICATE_TEMP_CLEANUP'))
      }
    }
    try {
      await rmdir(directory)
    } catch {
      await reportCaughtError('Temporary certificate directory cleanup failed', new Error('CERTIFICATE_TEMP_CLEANUP'))
    }
  }
}
