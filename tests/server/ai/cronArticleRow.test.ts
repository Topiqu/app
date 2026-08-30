import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const task = readFileSync(resolve(process.cwd(), 'server/tasks/generate-article.ts'), 'utf8')

/**
 * The cron builds its own `Article` row instead of going through `POST /api/articles`, so every
 * field the API path persists has to be repeated here — and a miss is invisible until an article
 * ships without it. `sources` was dropped once and `imageUrl` after it, both while
 * `finalizeArticle` had already done (and billed) the work that produced them.
 */
describe('generate-article cron row', () => {
  it('persists the cover image finalizeArticle resolved', () => {
    expect(task).toMatch(/imageUrl:\s*generated\.articleImageUrl/)
  })

  it('persists the citations through the linkable filter', () => {
    expect(task).toMatch(/sources:\s*linkableSources\(generated\.sources\)/)
  })

  // Without it a cron cover keeps its picture and loses the AI disclosure that goes under it.
  it('persists the cover provenance alongside the cover', () => {
    expect(task).toMatch(/imageCredit:\s*generated\.articleImageCredit/)
  })

  // Unwritten, the picker sees no history and drifts back to one shape for every article.
  it('persists the format and structure the topic picker chose, and feeds both back', () => {
    expect(task).toMatch(/format:\s*topic\?\.format/)
    expect(task).toMatch(/structureVariant:\s*topic\?\.variant/)
    expect(task).toMatch(/recentFormats:/)
    expect(task).toMatch(/recentStructures/)
    expect(task).toMatch(/excerpt:\s*true,[\s\S]*format:\s*true,[\s\S]*structureVariant:\s*true/)
  })

  it('reports active cron features whose stored frequency still disables scheduling', () => {
    expect(task).toContain("activeFeatureFilter('ARTICLE_CRONS')")
    expect(task).toContain("'frequency_disabled'")
    expect(task).toContain("action: 'CRON_ARTICLE_SKIPPED'")
    expect(task).toContain("if (site.reason === 'not_due') continue")
  })
})
