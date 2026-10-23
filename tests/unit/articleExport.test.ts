// @vitest-environment nuxt

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleWithDetails } from '../../types/article'

import { useExport } from '../../app/composables/useExport'

mockNuxtImport('useI18n', () => () => ({ locale: { value: 'cs' } }))

let downloadedBlob: Blob
const createObjectURL = vi.fn((blob: Blob) => {
  downloadedBlob = blob
  return 'blob:article-export'
})
const revokeObjectURL = vi.fn()

const article = (values: Partial<ArticleWithDetails> = {}) =>
  ({
    id: 'article-1',
    title: 'Článek o bezpečnosti',
    slug: 'clanek-o-bezpecnosti',
    status: 'draft',
    createdAt: '2026-10-22T12:00:00.000Z',
    imageUrl: null,
    content: '<p>Text článku</p>',
    ...values,
  }) as ArticleWithDetails

const readDownload = () =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(downloadedBlob)
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('article CSV download', () => {
  it.each(['=1+1', '+1+1', '-1+1', '@SUM(1)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '＝1+1', '＋1+1'])(
    'exports formula-like title %j as spreadsheet text',
    async (title) => {
      useExport().exportCsv(article({ title }))
      const text = await readDownload()
      const safeTitle = /[\r\n]/.test(title) ? `"'${title}"` : `'${title}`
      expect(text).toContain(`\n${safeTitle},clanek-o-bezpecnosti,`)
    },
  )

  it('protects all user-controlled columns and decodes HTML before checking the preview', async () => {
    useExport().exportCsv(article({ title: '=1+1', slug: '+slug', imageUrl: '@image', content: '<p>&#61;1+1</p>' }))
    const text = await readDownload()
    expect(text).toContain("\n'=1+1,'+slug,draft,")
    expect(text).toContain(',\'@image,"\'=1+1\n\n"')
  })

  it('preserves Czech text and CSV escaping for commas, quotes, CR and paragraph breaks', async () => {
    useExport().exportCsv(article({ title: 'Český, "citovaný"\rnázev', content: '<p>První</p><p>Druhý</p>' }))
    const text = await readDownload()
    expect(text).toContain('\n"Český, ""citovaný""\rnázev",clanek-o-bezpecnosti,')
    expect(text).toContain('"První\n\nDruhý\n\n"')
    expect(downloadedBlob.type).toBe('text/csv;charset=utf-8;')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:article-export')
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('releases the object URL and temporary anchor when starting a download throws', () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
      throw new Error('Download denied')
    })
    expect(() => useExport().exportCsv(article())).toThrow('Download denied')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:article-export')
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('does not create a download for empty exports', () => {
    useExport().exportCsv([])
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
