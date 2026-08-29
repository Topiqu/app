import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'server/api/articles/[id]/related/index.get.ts'), 'utf8')

describe('related article presentation', () => {
  it('queries only the current viewer reaction and returns a boolean to cards', () => {
    expect(source).toContain(
      "where: user?.id ? { userId: user.id } : sessionId ? { sessionId, userId: null } : { id: '' }",
    )
    expect(source).toContain('select: { id: true }')
    expect(source).toContain('likedByUser: reactions.length > 0')
    expect(source).toContain('map(({ reactions, ...article })')
  })
})
