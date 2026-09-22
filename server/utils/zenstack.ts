import type { User } from 'next-auth'

import { PolicyPlugin } from '@zenstackhq/plugin-policy'

// Raw SQL call sites either run system work or carry an explicit tenant predicate. This also
// keeps the audit advisory lock inside the same policy-enhanced transaction as its write.
const policyDb = prisma.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true }))

export const getEnhancedPrisma = async (user?: User) =>
  policyDb.$setAuth(
    user
      ? {
          ...user,
          email: user.email ?? undefined,
        }
      : undefined,
  )
