import argon from 'argon2'
import { PrismaClient } from '@prisma/client'

const basePrisma = new PrismaClient()

const calculateMetrics = (content: string, hourlyRate: number, wordsPerHour: number) => {
  const words = content.trim().split(/\s+/).length
  const speed = wordsPerHour > 0 ? wordsPerHour : 400

  return {
    totalWords: words,
    readingTime: Math.ceil(words / 200),
    savedTimeMinutes: Math.round((words / speed) * 60),
    savedAmount: (words / speed) * hourlyRate,
  }
}

const prismaClientSingleton = () => {
  return basePrisma.$extends({
    query: {
      article: {
        async create({ args, query }) {
          const content = args.data.content

          if (typeof content === 'string') {
            const clientSiteId = args.data.clientSiteId

            if (clientSiteId) {
              const clientSettings = await basePrisma.clientSite.findUnique({
                where: { id: clientSiteId },
                select: { humanHourlyRate: true, humanWordsPerHour: true },
              })

              if (clientSettings) {
                const metrics = calculateMetrics(
                  content,
                  clientSettings.humanHourlyRate,
                  clientSettings.humanWordsPerHour,
                )

                args.data.totalWords = metrics.totalWords
                args.data.readingTime = metrics.readingTime
                args.data.savedTimeMinutes = metrics.savedTimeMinutes
                args.data.savedAmount = metrics.savedAmount
              }
            }
          }

          return query(args)
        },

        async update({ args, query }) {
          const contentData = args.data.content
          const content =
            typeof contentData === 'object' && contentData && 'set' in contentData ? contentData.set : contentData

          if (typeof content === 'string') {
            const existingArticle = await basePrisma.article.findFirst({
              where: args.where,
              select: { clientSiteId: true },
            })

            if (existingArticle) {
              const clientSettings = await basePrisma.clientSite.findUnique({
                where: { id: existingArticle.clientSiteId },
                select: { humanHourlyRate: true, humanWordsPerHour: true },
              })

              if (clientSettings) {
                const metrics = calculateMetrics(
                  content,
                  clientSettings.humanHourlyRate,
                  clientSettings.humanWordsPerHour,
                )

                args.data.totalWords = metrics.totalWords
                args.data.readingTime = metrics.readingTime
                args.data.savedTimeMinutes = metrics.savedTimeMinutes
                args.data.savedAmount = metrics.savedAmount
              }
            }
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
              args.data.password =
                typeof pwd === 'object' && pwd && 'set' in pwd
                  ? { set: await argon.hash(value) }
                  : await argon.hash(value)
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
