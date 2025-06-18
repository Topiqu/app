export default defineEventHandler(async () => {
  await prisma.article.createMany({
    data: [
      {
        id: '1',
        slug: 'clanek-1',
        title: 'První článek',
        content: 'Obsah prvního článku',
        tags: ['novinky', 'tech'],
        status: 'draft',
        userId: 'f88a0494-a11e-42c9-afd7-af1116c1b501',
        createdAt: new Date(),
      },
      {
        id: '2',
        slug: 'clanek-2',
        title: 'Druhý článek',
        content: 'Obsah druhého článku',
        tags: ['tech', 'programování'],
        status: 'published',
        userId: 'f88a0494-a11e-42c9-afd7-af1116c1b501',
        createdAt: new Date(),
      },
    ],
  })
  return { message: 'Articles created' }
})
