import argon from 'argon2'
import { definePlugin } from '@zenstackhq/orm'

import { createDatabaseClient } from './database'
import { schema } from '../../generated/zenstack/schema'

const calculateBasicMetrics = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return {
    totalWords: words,
    readingTime: Math.ceil(words / 200),
  }
}

const appMutationPlugin = definePlugin(schema, {
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
        const metrics = calculateBasicMetrics(content)
        if (operation === 'create' || typeof articleData.totalWords === 'undefined') {
          articleData.totalWords = metrics.totalWords
        }
        if (operation === 'create' || typeof articleData.readingTime === 'undefined') {
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

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export default prisma
