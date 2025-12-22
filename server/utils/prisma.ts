import argon from 'argon2'
import { PrismaClient } from '@prisma/client'

const basePrisma = new PrismaClient()

const calculateBasicMetrics = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return {
    totalWords: words,
    readingTime: Math.ceil(words / 200),
  }
}

const prismaClientSingleton = () => {
  return basePrisma.$extends({
    query: {
      article: {
        async create({ args, query }) {
          if (typeof args.data.content === 'string') {
            const metrics = calculateBasicMetrics(args.data.content)
            args.data.totalWords = metrics.totalWords
            args.data.readingTime = metrics.readingTime
          }
          return query(args)
        },
        async update({ args, query }) {
          const contentData = args.data.content
          const content =
            typeof contentData === 'object' && contentData && 'set' in contentData ? contentData.set : contentData

          if (typeof content === 'string') {
            const metrics = calculateBasicMetrics(content)
            if (typeof args.data.totalWords === 'undefined') args.data.totalWords = metrics.totalWords
            if (typeof args.data.readingTime === 'undefined') args.data.readingTime = metrics.readingTime
          }
          return query(args)
        },
      },
      user: {
        async create({ args, query }) {
          if (typeof args.data.password === 'string') {
            args.data.password = await argon.hash(args.data.password)
          }
          return query(args)
        },
        async update({ args, query }) {
          if ('password' in args.data) {
            const pwd = args.data.password
            const value = typeof pwd === 'object' && pwd && 'set' in pwd ? pwd.set : pwd
            if (typeof value === 'string' && value.length > 0) {
              const hashed = await argon.hash(value)
              args.data.password = typeof pwd === 'object' && pwd && 'set' in pwd ? { set: hashed } : hashed
            } else {
              delete args.data.password
            }
          }
          return query(args)
        },
      },
    },
  })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export default prisma
