import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/autor/[name].vue'), 'utf8')
const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/[id]/by-author.ts'), 'utf8')

describe('author article presentation', () => {
  it('encodes author names before constructing the SSR data URL', () => {
    expect(page).toContain('`/api/articles/${encodeURIComponent(username.value)}/by-author`')
  })

  it('returns lightweight cards with the current viewer reaction', () => {
    expect(endpoint).toContain("where: user?.id ? { userId: user.id } : { id: '' }")
    expect(endpoint).toContain('omit: { content: true }')
    expect(endpoint).toContain('likedByUser: reactions.length > 0')
    expect(endpoint).toContain('items.map(({ reactions, ...article })')
  })
})
