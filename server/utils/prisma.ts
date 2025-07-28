import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () =>
  new PrismaClient().$extends({
    query: {
      article: {
        create({ args, query }) {
          if (typeof args.data.content === 'string') {
            const words = args.data.content.trim().split(/\s+/).length
            args.data.readingTime = Math.ceil(words / 200)
          }
          return query(args)
        },
        update({ args, query }) {
          const content = args.data.content
          const value = typeof content === 'object' && 'set' in content ? content.set : content

          if (typeof value === 'string') {
            const words = value.trim().split(/\s+/).length
            args.data.readingTime = Math.ceil(words / 200)
          }

          return query(args)
        },
      },
    },
  })

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
globalThis.prismaGlobal = prisma

export default prisma
