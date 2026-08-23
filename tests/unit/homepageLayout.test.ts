import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/pages/index.vue'), 'utf8')

describe('homepage hero identity', () => {
  it('does not visually repeat the client name when a logo is present', () => {
    expect(source).toContain('<h1 v-if="clientSite?.logoUrl" class="sr-only">')
    expect(source).toContain('<div v-else class="home-hero__heading">')
  })
})
