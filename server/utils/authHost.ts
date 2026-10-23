export const isPlatformAuthHost = (hostname: string) =>
  isManagedDomain(hostname) ||
  (!isSecureAuth && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')))
