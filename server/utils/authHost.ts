import { isSecureAuth } from './authCookie'
import { isManagedDomain } from '../../shared/utils/domain'

export const isPlatformAuthHost = (hostname: string) =>
  isManagedDomain(hostname) ||
  (!isSecureAuth && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')))
