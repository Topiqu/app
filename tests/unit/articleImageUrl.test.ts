import { describe, expect, it } from 'vitest'
import { schema } from '~~/generated/zenstack/schema'
import { createQuerySchemaFactory } from '@zenstackhq/orm'

// Media library assets hotlink sources like Wikimedia, whose thumbnail URLs run past 255 characters.
const wikimediaCover = `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/${'Doctor%27s_office_-_New_Orleans'.repeat(8)}.jpg/1280px-cover.jpg`
const tooLong = `https://example.com/${'a'.repeat(2048)}`

const site = '00000000-0000-4000-8000-000000000001'
const factory = createQuerySchemaFactory(schema)

const articleAccepts = (imageUrl: string) =>
  factory.makeCreateSchema('Article').safeParse({
    data: {
      userId: site,
      language: 'cs',
      slug: 'cover',
      title: 'Cover',
      content: '<p>Body</p>',
      clientSiteId: site,
      imageUrl,
    },
  }).success

const seriesAccepts = (imageUrl: string) =>
  factory.makeCreateSchema('ArticleSeries').safeParse({
    data: { name: 'Series', slug: 'series', clientSiteId: site, imageUrl },
  }).success

describe('cover image URL length', () => {
  it('accepts a media library cover as long as the media asset itself allows', () => {
    expect(wikimediaCover.length).toBeGreaterThan(255)
    expect(articleAccepts(wikimediaCover)).toBe(true)
    expect(seriesAccepts(wikimediaCover)).toBe(true)
  })

  it('still rejects a URL beyond the media asset limit', () => {
    expect(articleAccepts(tooLong)).toBe(false)
    expect(seriesAccepts(tooLong)).toBe(false)
  })
})
