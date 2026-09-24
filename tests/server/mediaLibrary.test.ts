import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('media library server boundaries', () => {
  it('scopes listing, detail and mutations to the active tenant', () => {
    for (const path of [
      'server/api/media/index.get.ts',
      'server/api/media/[id]/index.get.ts',
      'server/api/media/[id]/archive.post.ts',
      'server/api/media/[id]/restore.post.ts',
      'server/api/media/[id]/index.delete.ts',
    ]) {
      const code = source(path)
      expect(code, path).toContain("requireTenantScope(event, 'ARTICLE_WRITE')")
      expect(code, path).toContain('clientSiteId: user.clientSiteId!')
    }
  })

  it('uses numbered pagination and never lists purged assets', () => {
    const code = source('server/api/media/index.get.ts')
    expect(code).toContain('skip: (query.page - 1) * query.limit')
    expect(code).toContain('take: query.limit')
    expect(code).toContain('mediaAsset.count')
    expect(code).toContain('purgedAt: null')
  })

  it('blocks physical deletion while any article or draft still references an asset', () => {
    const remove = source('server/api/media/[id]/index.delete.ts')
    const safety = source('server/utils/mediaLibrary.ts')
    expect(remove).toContain('findMediaReferences')
    expect(remove).toContain("code: 'MEDIA_IN_USE'")
    expect(safety).toContain('articleDraft.count')
    expect(safety).toContain('articleTranslation.count')
    expect(safety).toContain('articleMediaUsage.count')
  })

  it('keeps storage deletion behind a delayed task and allowed prefixes', () => {
    const task = source('server/tasks/media-gc.ts')
    expect(task).toContain('findMediaReferences')
    expect(task).toContain("key.startsWith('uploads/')")
    expect(task).toContain("key.startsWith('article-images/')")
    expect(task).toContain('deleteFromCdn(key, prefix)')
  })
})
