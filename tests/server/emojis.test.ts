import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('custom emoji creation', () => {
  const create = source('server/api/emojis/index.post.ts')

  it('authorizes and checks duplicates before writing a file', () => {
    const auth = create.indexOf("user.role !== 'admin'")
    const duplicate = create.indexOf('if (existing)')
    const put = create.indexOf('await putToCdn(')

    expect(auth).toBeGreaterThan(-1)
    expect(duplicate).toBeGreaterThan(auth)
    expect(put).toBeGreaterThan(duplicate)
  })

  it('normalizes the shortcode and prepares the image server-side', () => {
    expect(create).toContain('normalizeEmojiShortcode')
    expect(create).toContain('isValidEmojiShortcode')
    expect(create).toContain('await prepareEmojiImage(file.data)')
  })

  it('uses the shared central upload path with a server-generated uuid', () => {
    expect(create).toContain('`uploads/emoji-${randomUUID()}.webp`')
    expect(create).not.toContain('clientSiteId}/')
  })

  it('rolls the exact CDN object back when the database insert fails', () => {
    expect(create).toMatch(/catch[\s\S]*deleteFromCdn\(key, 'uploads\/'\)/)
    expect(create).toContain("error?.code === 'P2002'")
  })
})

describe('custom emoji deletion', () => {
  const remove = source('server/api/emojis/[id]/index.delete.ts')
  const image = source('server/utils/emojiImage.ts')

  it('scopes ownership through the central database before deleting the CDN object', () => {
    expect(remove.indexOf('clientSiteId: user.clientSiteId')).toBeLessThan(remove.indexOf('deleteFromCdn('))
    expect(remove).toContain("deleteFromCdn(key, 'uploads/')")
    expect(image).toContain('/^\\/uploads\\/emoji-[a-f0-9-]+\\.webp$/')
  })

  it('reports the number of reactions removed by the cascade', () => {
    expect(remove).toContain('_count: { select: { emojiReactions: true } }')
    expect(remove).toContain('deletedReactions: emoji._count.emojiReactions')
  })
})
