import { randomBytes, randomUUID } from 'node:crypto'

const AUTHOR_SELECT = { id: true, username: true, bio: true, avatarUrl: true } as const
type AiAuthor = { id: string; username: string; bio: string | null; avatarUrl: string | null }

/** New sites get an author at signup; generation also repairs older sites before assigning a byline. */
export async function ensureAiAuthor(clientSiteId: string, tx?: DatabaseTransaction): Promise<AiAuthor> {
  const ensure = async (db: DatabaseTransaction) => {
    const findAuthor = () =>
      db.user.findFirst({
        where: { clientSiteId, role: 'ai', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: AUTHOR_SELECT,
      })

    const existing = await findAuthor()
    if (existing) return existing

    // Every creator locks the same parent row before checking again, including concurrent crons.
    const site = await db.clientSite.update({
      where: { id: clientSiteId },
      data: { updatedAt: new Date() },
      select: { name: true, language: true, logoUrl: true },
    })
    const concurrent = await findAuthor()
    if (concurrent) return concurrent

    const baseName = defaultAiAuthorName(site.name, site.language)
    for (let attempt = 0; attempt < 3; attempt++) {
      const suffix = attempt ? ` ${randomBytes(4).toString('hex')}` : ''
      const username =
        baseName
          .slice(0, 50 - suffix.length)
          .replace(/[\uD800-\uDBFF]$/, '')
          .trimEnd() + suffix
      const author = {
        id: randomUUID(),
        username,
        email: `ai-${randomUUID()}@generated.ai`,
        bio: '',
        avatarUrl: site.logoUrl || null,
        role: 'ai' as const,
        language: site.language,
        clientSiteId,
        emailVerified: true,
        allowNotifs: false,
        allowEmail: false,
      }
      // A global username collision must not abort the surrounding signup transaction.
      const created = await db.user.createMany({ data: [author], skipDuplicates: true })
      if (!created.count) continue

      await logAction({
        action: 'AI_USER_CREATE',
        clientSiteId,
        metadata: { aiUserId: author.id, source: 'default' },
        tx: db,
      })
      return { id: author.id, username, bio: author.bio, avatarUrl: author.avatarUrl }
    }
    throw new Error('Could not allocate an AI author username')
  }

  return tx ? ensure(tx) : serializableTransaction(ensure)
}
