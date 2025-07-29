import type { User } from 'next-auth'

import { enhance } from '@zenstackhq/runtime'

export const getEnhancedPrisma = async (user?: User) =>
  enhance(prisma, { user: user?.id ? { id: user.id } : undefined })
