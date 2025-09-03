export default defineTask({
  meta: {
    name: 'publish:check',
    description: 'Publishes scheduled articles',
  },
  async run() {
    const now = new Date()

    const result = await prisma.article.updateMany({
      where: { status: 'draft', releaseAt: { lte: now } },
      data: { status: 'published' },
    })

    return {
      result: {
        count: result.count,
        timestamp: now.toISOString(),
      },
    }
  },
})
