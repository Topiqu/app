import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const source = read('app/pages/index.vue')

const taglineTags = (code: string) => {
  const tags = [...code.matchAll(/<p\b[^>]*[Tt]agline[^>]*>/g)].map((match) => match[0])
  expect(tags.length).toBeGreaterThan(0)
  return tags
}

const at = (needle: string) => {
  const index = source.indexOf(needle)
  expect(index, needle).toBeGreaterThan(-1)
  return index
}

describe('homepage hero identity', () => {
  it('does not visually repeat the client name when a logo is present', () => {
    expect(source).toContain('<h1 v-if="clientSite?.logoUrl" class="sr-only">')
    expect(source).toContain('<div v-else class="home-hero__heading">')
  })

  it('reads as a masthead: mark, then name, then tagline, then description', () => {
    expect(at('containerClass="h-28 w-48 rounded-')).toBeLessThan(at('v-if="clientSite?.logoUrl" class="sr-only"'))
    expect(at('v-if="clientSite?.logoUrl" class="sr-only"')).toBeLessThan(at('v-if="clientSite?.tagline"'))
    expect(at('v-if="clientSite?.tagline"')).toBeLessThan(at('v-if="clientSite?.description"'))
  })

  it('keeps the tagline out of the logo row, where min-width:auto stopped it shrinking', () => {
    expect(source).not.toMatch(/<div class="flex items-center gap-4">[\s\S]*?clientSite\.tagline/)
  })

  it('caps the tagline measure and breaks a word too long for the column', () => {
    for (const tag of taglineTags(source)) {
      expect(tag).toContain('max-w-[46ch]')
      expect(tag).toContain('break-words')
    }
  })
})

describe('tagline treatment across the publication surfaces', () => {
  const surfaces = [
    'app/pages/index.vue',
    'app/components/Article/Empty/Visitor.vue',
    'app/components/Form/Client/Branding.vue',
  ]

  it.each(surfaces)('%s sizes the tagline above the muted description, not like a meta label', (path) => {
    for (const tag of taglineTags(read(path))) {
      expect(tag).toContain('text-base')
      expect(tag).toContain('text-highlighted')
      expect(tag).not.toContain('text-primary')
    }
  })

  it('renders the tagline below the name everywhere, including both settings previews', () => {
    const previews = read('app/components/Form/Client/Branding.vue')
    for (const block of previews.split('data-publication-preview').slice(1)) {
      expect(block.indexOf('<h3'), 'name precedes tagline').toBeLessThan(block.indexOf('v-if="localTagline"'))
    }
    const visitor = read('app/components/Article/Empty/Visitor.vue')
    expect(visitor.indexOf('<h1')).toBeLessThan(visitor.indexOf('v-if="site?.tagline"'))
  })
})
