// Compiled browser tests run with NODE_ENV=production against loopback HTTP and a disposable database,
// so production-only secure/domain cookies cannot be used there.
export const isSecureAuth = process.env.NODE_ENV === 'production' && !process.env.TEST_DATABASE_URL

// TODO: For strict multi-tenant (isolated accounts), set this to undefined to prevent session sharing across domains.
export const sessionCookieDomain = isSecureAuth ? '.topiqu.com' : undefined
