import argon from 'argon2'
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
      user: {
        async create({ args, query }) {
          if (typeof args.data.password === 'string') {
            args.data.password = await argon.hash(args.data.password)
          }
          return query(args)
        },
        async update({ args, query }) {
          const pwd = args.data.password ?? ''
          const value = typeof pwd === 'object' && 'set' in pwd ? pwd.set : pwd

          if (typeof value === 'string') {
            args.data.password =
              typeof pwd === 'object' && 'set' in pwd ? { set: await argon.hash(value) } : await argon.hash(value)
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
