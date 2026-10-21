import { encryptDomainCertificate, decryptDomainCertificate } from '../server/utils/domains/certificates'
import {
  checkCloudflareFallback,
  dokployRequest,
  domainProviderConfig,
  DomainProviderError,
} from '../server/utils/domains/providers'

// Read-only diagnostics. Never print provider responses, URLs, tokens or certificate material.
let failed = false
try {
  const config = domainProviderConfig()
  if (decryptDomainCertificate(encryptDomainCertificate('check', 'preflight'), 'preflight') !== 'check')
    throw new Error('CONFIGURATION')
  for (const [name, check] of [
    ['cloudflare-fallback', () => checkCloudflareFallback()],
    [
      'dokploy-domain-read',
      () => dokployRequest('domain.byApplicationId', 'GET', { applicationId: config.applicationId }),
    ],
  ] as const) {
    try {
      await check()
      console.info(`${name}: OK`)
    } catch (error) {
      failed = true
      const code = error instanceof DomainProviderError ? error.code : 'FAILED'
      const status = error instanceof DomainProviderError && error.httpStatus ? ` (HTTP ${error.httpStatus})` : ''
      console.error(`${name}: ${code}${status}`)
    }
  }
} catch {
  failed = true
  console.error('configuration: INVALID (check domain integration ENV values)')
}
if (failed) process.exitCode = 1
