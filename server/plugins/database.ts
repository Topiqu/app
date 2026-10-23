import prisma from '../utils/prisma'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', () => prisma.$disconnect())
})
