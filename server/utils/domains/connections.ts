import { randomBytes, randomUUID } from 'node:crypto'
import { isManagedDomain } from '~~/shared/utils/domain'
import { mergeDomainValidationRecords } from '~~/shared/utils/domainRecords'

import { probeDomainRouting } from './probe'
import { decryptDomainCertificate, verifyDomainCertificate } from './certificates'
import {
  DomainProviderError,
  cloudflareDomain,
  checkCloudflareFallback,
  cloudflareValidationRecords,
  dokployDomainSchema,
  dokployRequest,
  domainProviderConfig,
  findDokployDomain,
} from './providers'

export const domainConnectionPublicSelect = {
  id: true,
  host: true,
  state: true,
  certificateMode: true,
  certificateExpiresAt: true,
  validationRecords: true,
  errorCode: true,
  checkedAt: true,
  cleanupRequestedAt: true,
} as const

const domainConnectionSecrets = {
  challenge: false,
  probeSecret: false,
  cloudflareId: false,
  dokployId: false,
  certificateId: false,
  encryptedCertificate: false,
  leaseId: false,
} as const

export const loadDomainConnection = (id: string) =>
  prisma.domainConnection.findUniqueOrThrow({
    where: { id },
    omit: domainConnectionSecrets,
  })

// System context: caller has authorized tenant settings or is a scheduled reconciliation task.
export const reserveDomainConnection = async (
  clientSiteId: string,
  host: string,
  challenge: string,
  database: Pick<typeof prisma, 'domainConnection'> = prisma,
) => {
  if (isManagedDomain(host)) return null
  domainProviderConfig()
  const existing = await database.domainConnection.findUnique({ where: { host }, omit: domainConnectionSecrets })
  if (
    (!existing || existing.state === 'DISCONNECTED') &&
    (await database.domainConnection.count({ where: { clientSiteId, state: { not: 'DISCONNECTED' } } })) >= 3
  )
    throw new DomainProviderError('DOMAIN_LIMIT')
  if (existing) {
    if (existing.state === 'DISCONNECTED' && !existing.cloudflareId && !existing.dokployId && !existing.certificateId) {
      const claimed = await database.domainConnection.updateMany({
        where: {
          id: existing.id,
          state: 'DISCONNECTED',
          challenge: existing.challenge,
          clientSiteId: existing.clientSiteId,
          cloudflareId: null,
          dokployId: null,
          certificateId: null,
        },
        data: {
          clientSiteId,
          challenge,
          probeSecret: randomBytes(32).toString('hex'),
          state: 'OWNERSHIP',
          deletedAt: null,
          cleanupRequestedAt: null,
          validationRecords: [],
          errorCode: null,
          certificateMode: 'AUTO',
          certificateExpiresAt: null,
          certificateWarnedAt: null,
          certificateFingerprint: null,
          encryptedCertificate: null,
          cloudflareManaged: false,
          dokployManaged: false,
          ownershipLostAt: null,
        },
      })
      if (!claimed.count) throw new DomainProviderError('DOMAIN_RESERVED')
      return database.domainConnection.findUniqueOrThrow({ where: { id: existing.id }, omit: domainConnectionSecrets })
    }
    if (existing.clientSiteId === clientSiteId && existing.cleanupRequestedAt)
      throw new DomainProviderError('DOMAIN_CLEANUP_PENDING')
    if (existing.clientSiteId !== clientSiteId || existing.challenge !== challenge)
      throw new DomainProviderError('DOMAIN_RESERVED')
    return existing
  }
  try {
    return await database.domainConnection.create({
      data: {
        clientSiteId,
        host,
        challenge,
        probeSecret: randomBytes(32).toString('hex'),
      },
    })
  } catch {
    throw new DomainProviderError('DOMAIN_RESERVED')
  }
}

export const withDomainLease = async <T>(id: string, task: (leaseId: string) => Promise<T>) => {
  const leaseId = randomUUID()
  const now = new Date()
  const claimed = await prisma.domainConnection.updateMany({
    where: { id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseId, leaseUntil: new Date(now.getTime() + 300000) },
  })
  if (!claimed.count) throw new DomainProviderError('BUSY')
  try {
    return await task(leaseId)
  } finally {
    await prisma.domainConnection.updateMany({ where: { id, leaseId }, data: { leaseId: null, leaseUntil: null } })
  }
}

export const reconcileDomainConnection = async (id: string, expectedClientSiteId?: string, cleanupOnly = false) =>
  withDomainLease(id, async (leaseId) => {
    const connection = await loadDomainConnection(id)
    if (expectedClientSiteId && connection.clientSiteId !== expectedClientSiteId)
      throw new DomainProviderError('DOMAIN_RESERVED')
    if (cleanupOnly && !connection.cleanupRequestedAt) return { ready: false, state: connection.state }
    const save = async (data: Parameters<typeof prisma.domainConnection.updateMany>[0]['data']) => {
      const result = await prisma.domainConnection.updateMany({ where: { id, leaseId }, data })
      if (!result.count) throw new DomainProviderError('BUSY')
    }
    try {
      if (connection.cleanupRequestedAt) {
        await cleanupDomainProviders(connection)
        await save({
          state: 'DISCONNECTED',
          encryptedCertificate: null,
          cloudflareId: null,
          dokployId: null,
          certificateId: null,
          errorCode: null,
          checkedAt: new Date(),
        })
        return { ready: false, state: 'DISCONNECTED' }
      }
      const config = domainProviderConfig()
      const site = await prisma.clientSite.findUniqueOrThrow({
        where: { id: connection.clientSiteId },
        select: {
          domain: true,
          pendingDomain: true,
          pendingDomainToken: true,
          pendingDomainRequestedAt: true,
          domainVerificationToken: true,
          domainVerificationStatus: true,
          deletedAt: true,
          plan: true,
        },
      })
      const current = site.domain === connection.host && site.domainVerificationToken === connection.challenge
      const pending = site.pendingDomain === connection.host && site.pendingDomainToken === connection.challenge
      if (
        pending &&
        !current &&
        site.pendingDomainRequestedAt &&
        site.pendingDomainRequestedAt.getTime() < Date.now() - 7 * 86400000
      ) {
        await prisma.$transaction(async (tx) => {
          await tx.clientSite.updateMany({
            where: {
              id: connection.clientSiteId,
              pendingDomain: connection.host,
              pendingDomainToken: connection.challenge,
            },
            data: { pendingDomain: null, pendingDomainToken: null, pendingDomainRequestedAt: null },
          })
          await tx.domainConnection.updateMany({
            where: { id, leaseId },
            data: { cleanupRequestedAt: new Date(), state: 'DISCONNECTING' },
          })
        })
        return { ready: false, state: 'DISCONNECTING' }
      }
      if (site.deletedAt || (current && site.domainVerificationStatus === 'FAILED') || (!current && !pending)) {
        await save({ cleanupRequestedAt: new Date(), state: 'DISCONNECTING' })
        return { ready: false, state: 'DISCONNECTING' }
      }
      if (site.plan === 'BASIC') {
        await save({ errorCode: 'PLAN_REQUIRED', checkedAt: new Date() })
        return { ready: false, state: 'PLAN_REQUIRED' }
      }
      const dns = await checkDomainDns(connection.host, connection.challenge)
      if (!dns.ownershipVerified) {
        const transient = dns.dnsStatus.txt !== 0 && dns.dnsStatus.txt !== 3
        await save({
          state: transient ? 'DNS_UNAVAILABLE' : 'OWNERSHIP',
          errorCode: transient ? 'DNS_UNAVAILABLE' : 'TXT_MISMATCH',
          checkedAt: new Date(),
        })
        return { ready: false, state: transient ? 'DNS_UNAVAILABLE' : 'OWNERSHIP', transient }
      }
      await save({ state: 'CERTIFICATE', errorCode: null, checkedAt: new Date() })
      await checkCloudflareFallback()
      let dokploy = await findDokployDomain(connection.host, connection.dokployId ?? undefined)
      if (dokploy && dokploy.domainId !== connection.dokployId) throw new DomainProviderError('ADOPTION_REQUIRED')
      if (!dokploy) {
        if (connection.dokployId) {
          if (!connection.dokployManaged || (await findDokployDomain(connection.host)))
            throw new DomainProviderError('ADOPTION_REQUIRED')
        }
        dokploy = dokployDomainSchema.parse(
          await dokployRequest('domain.create', 'POST', {
            host: connection.host,
            applicationId: config.applicationId,
            domainType: 'application',
            port: config.port,
            path: '/',
            https: true,
            certificateType:
              connection.encryptedCertificate || connection.certificateMode === 'CUSTOM' ? 'none' : 'letsencrypt',
          }),
        )
        if (
          dokploy.host !== connection.host ||
          dokploy.applicationId !== config.applicationId ||
          dokploy.port !== config.port
        )
          throw new DomainProviderError('PROVIDER_CONFLICT')
        await save({ dokployId: dokploy.domainId, dokployManaged: true })
      }
      let cf = await cloudflareDomain(
        'GET',
        connection.cloudflareId ?? undefined,
        connection.cloudflareId ? undefined : connection.host,
      )
      if (cf && cf.hostname !== connection.host) throw new DomainProviderError('PROVIDER_CONFLICT')
      if (cf && cf.id !== connection.cloudflareId) throw new DomainProviderError('ADOPTION_REQUIRED')
      if (!cf) {
        if (connection.cloudflareId && !connection.cloudflareManaged) throw new DomainProviderError('ADOPTION_REQUIRED')
        if (connection.cloudflareId && (await cloudflareDomain('GET', undefined, connection.host)))
          throw new DomainProviderError('ADOPTION_REQUIRED')
        cf = await cloudflareDomain('POST', undefined, connection.host)
        if (!cf) throw new DomainProviderError('CLOUDFLARE_UNAVAILABLE')
        if (cf.hostname !== connection.host) throw new DomainProviderError('PROVIDER_CONFLICT')
        await save({ cloudflareId: cf.id, cloudflareManaged: true })
      }
      // Preserve new DNS instructions even if a later origin/certificate operation fails.
      const validationRecords = mergeDomainValidationRecords(
        connection.validationRecords,
        cloudflareValidationRecords(cf),
      )
      await save({ validationRecords })
      if (connection.encryptedCertificate) {
        const material = JSON.parse(decryptDomainCertificate(connection.encryptedCertificate, id)) as {
          certificate: string
          privateKey: string
        }
        const certificate = await verifyDomainCertificate(connection.host, material.certificate, material.privateKey)
        const certificateId = connection.certificateId ?? randomUUID()
        // Persist the deterministic certificate ID before upload, so a timed-out POST can be recovered safely.
        await save({ certificateId })
        let exists = false
        try {
          const found = (await dokployRequest('certificates.one', 'GET', { certificateId })) as {
            name?: string
            organizationId?: string
          }
          if (found.name !== `topiqu-domain-${id}` || found.organizationId !== config.organizationId)
            throw new DomainProviderError('PROVIDER_CONFLICT')
          exists = true
        } catch (error) {
          if (!(error instanceof DomainProviderError && error.httpStatus === 404)) throw error
        }
        await dokployRequest(exists ? 'certificates.update' : 'certificates.create', 'POST', {
          certificateId,
          name: `topiqu-domain-${id}`,
          organizationId: config.organizationId,
          certificateData: material.certificate,
          privateKey: material.privateKey,
          autoRenew: false,
        })
        await dokployRequest('domain.update', 'POST', {
          domainId: dokploy.domainId,
          host: connection.host,
          https: true,
          certificateType: 'custom',
        })
        await save({
          encryptedCertificate: null,
          certificateMode: 'CUSTOM',
          certificateExpiresAt: certificate.expiresAt,
          certificateFingerprint: certificate.fingerprint,
          certificateWarnedAt: null,
        })
      }
      if (
        !connection.encryptedCertificate &&
        connection.certificateMode === 'CUSTOM' &&
        connection.certificateExpiresAt &&
        connection.certificateExpiresAt.getTime() <= Date.now()
      ) {
        await save({ state: 'CERTIFICATE', errorCode: 'CERTIFICATE_EXPIRED', checkedAt: new Date() })
        return { ready: false, state: 'CERTIFICATE' }
      }
      const edgeReady = cf.status === 'active' && cf.ssl?.status === 'active'
      const routing = edgeReady && (await probeDomainRouting(connection.host, connection.probeSecret))
      const state = !edgeReady ? 'CERTIFICATE' : !routing ? 'ROUTING' : 'READY'
      await save({ state, validationRecords, errorCode: null, checkedAt: new Date() })
      return { ready: state === 'READY', state }
    } catch (error) {
      const code = error instanceof DomainProviderError ? error.code : 'PROVISIONING_FAILED'
      await save({ errorCode: code, checkedAt: new Date() })
      await reportCaughtError('Domain provisioning failed', new Error(code), { connectionId: id })
      return { ready: false, state: 'ERROR', transient: true }
    }
  })

// The address switch is already committed; keep cleanup retryable if another worker holds the lease.
export const attemptDomainCleanup = async (id: string, clientSiteId: string) => {
  try {
    await reconcileDomainConnection(id, clientSiteId, true)
  } catch (error) {
    if (!(error instanceof DomainProviderError && error.code === 'BUSY'))
      await reportCaughtError('Domain cleanup attempt failed', new Error('DOMAIN_CLEANUP_FAILED'), { connectionId: id })
  }
}

const cleanupDomainProviders = async (connection: Awaited<ReturnType<typeof loadDomainConnection>>) => {
  // Delete only resources created by this connection, after rechecking their identities.
  if (connection.cloudflareId && connection.cloudflareManaged) {
    const cf = await cloudflareDomain('GET', connection.cloudflareId)
    if (cf && cf.hostname !== connection.host) throw new DomainProviderError('PROVIDER_CONFLICT')
    if (cf) await cloudflareDomain('DELETE', connection.cloudflareId)
    await prisma.domainConnection.update({ where: { id: connection.id }, data: { cloudflareId: null } })
  }
  if (connection.dokployId && connection.dokployManaged) {
    const origin = await findDokployDomain(connection.host, connection.dokployId)
    if (origin && origin.domainId !== connection.dokployId) throw new DomainProviderError('PROVIDER_CONFLICT')
    if (origin) await dokployRequest('domain.delete', 'POST', { domainId: origin.domainId })
    await prisma.domainConnection.update({ where: { id: connection.id }, data: { dokployId: null } })
  }
  if (connection.certificateId) {
    try {
      const certificate = (await dokployRequest('certificates.one', 'GET', {
        certificateId: connection.certificateId,
      })) as { name?: string; organizationId?: string }
      if (
        certificate.name !== `topiqu-domain-${connection.id}` ||
        certificate.organizationId !== domainProviderConfig().organizationId
      )
        throw new DomainProviderError('PROVIDER_CONFLICT')
      await dokployRequest('certificates.remove', 'POST', { certificateId: connection.certificateId })
    } catch (error) {
      if (!(error instanceof DomainProviderError && error.httpStatus === 404)) throw error
    }
    await prisma.domainConnection.update({ where: { id: connection.id }, data: { certificateId: null } })
  }
}
