import argon from 'argon2'
import { definePlugin } from '@zenstackhq/orm'

import { schema } from '../../generated/zenstack/schema'

export const appMutationPlugin = definePlugin(schema, {
  id: 'app-mutations',
  async onQuery({ model, operation, args, proceed }) {
    const data = args?.data
    if (!data || typeof data !== 'object') return proceed(args)

    if (model === 'Article' && (operation === 'create' || operation === 'update')) {
      const articleData = data as Record<string, unknown>
      const contentData = articleData.content
      const content =
        typeof contentData === 'object' && contentData && 'set' in contentData
          ? (contentData as { set?: unknown }).set
          : contentData

      if (typeof content === 'string') {
        const metrics = articleTextMetrics(content)
        if (typeof articleData.totalWords === 'undefined') {
          articleData.totalWords = metrics.totalWords
        }
        if (typeof articleData.readingTime === 'undefined') {
          articleData.readingTime = metrics.readingTime
        }
      }
    }

    if (model === 'User' && operation === 'create') {
      const userData = data as Record<string, unknown>
      if (typeof userData.password === 'string') userData.password = await argon.hash(userData.password)
    }

    if (model === 'User' && operation === 'update') {
      const userData = data as Record<string, unknown>
      if ('password' in userData) {
        const passwordData = userData.password
        const password =
          typeof passwordData === 'object' && passwordData && 'set' in passwordData
            ? (passwordData as { set?: unknown }).set
            : passwordData

        if (typeof password === 'string' && password.length > 0) {
          const hashed = await argon.hash(password)
          userData.password =
            typeof passwordData === 'object' && passwordData && 'set' in passwordData ? { set: hashed } : hashed
        } else {
          delete userData.password
        }
      }
    }

    return proceed(args)
  },
})

const prismaClientSingleton = () => createDatabaseClient().$use(appMutationPlugin)

const appGlobal = globalThis as typeof globalThis & {
  prismaGlobal?: ReturnType<typeof prismaClientSingleton>
}

const prisma = appGlobal.prismaGlobal ?? prismaClientSingleton()
if (process.env.NODE_ENV !== 'production') appGlobal.prismaGlobal = prisma

export const disconnectDatabase = async () => {
  if (appGlobal.prismaGlobal === prisma) delete appGlobal.prismaGlobal
  await prisma.$disconnect()
}

export default prisma
