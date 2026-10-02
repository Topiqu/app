import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { canManageArticle, dropBlankLines, isBlankArticle, publishAction } from '../../shared/utils/articleEditor'

const editorSource = readFileSync(resolve(process.cwd(), 'app/pages/admin/editor/[id].vue'), 'utf8')
const generationStore = readFileSync(resolve(process.cwd(), 'app/stores/articleGeneration.ts'), 'utf8')
const clientSiteSource = readFileSync(resolve(process.cwd(), 'app/composables/useClientSite.ts'), 'utf8')

describe('generated article modules', () => {
  it('renders extraction fields in the editor canvas', () => {
    expect(editorSource).toContain(
      'const activeExtraction = computed(() => (tr.isSource ? editedArticle.value : tr.active))',
    )
    expect(editorSource.match(/:answer="activeExtraction\?\.answer"/g)).toHaveLength(2)
    expect(editorSource.match(/:takeaways="activeExtraction\?\.keyTakeaways \?\? \[\]"/g)).toHaveLength(2)
    expect(editorSource).toContain(':entries="readFaq(activeExtraction?.faq)"')
    expect(editorSource).toContain(':faq="activeExtraction?.faq"')
    expect(editorSource).toContain('<ArticleEditorGenerationRun')
    expect(generationStore).toContain('finishGenerationRun(run.value, outcome, Date.now())')
  })

  it('replaces the shared wallet value and waits out reservation settlement after Stop', () => {
    expect(clientSiteSource).toContain('status.data.value = {')
    expect(clientSiteSource).toContain('status.articleWallet.reserved <= reservedBefore')
    expect(generationStore).toContain('patchClientSiteArticleWallet({')
    expect(generationStore).toContain('refreshClientSiteStatusAfterStop(reservedBefore)')
  })
})

describe('canManageArticle', () => {
  const article = { clientSiteId: 'site-1' }

  it('admits any admin of the owning tenant, author or not', () => {
    expect(canManageArticle({ role: 'admin', clientSiteId: 'site-1' }, article)).toBe(true)
  })

  it('refuses another tenant, a non-admin and an absent session', () => {
    expect(canManageArticle({ role: 'admin', clientSiteId: 'site-2' }, article)).toBe(false)
    expect(canManageArticle({ role: 'user', clientSiteId: 'site-1' }, article)).toBe(false)
    expect(canManageArticle(null, article)).toBe(false)
  })

  it('refuses superadmin, which the ZenStack rule does not cover either', () => {
    expect(canManageArticle({ role: 'superadmin', clientSiteId: 'site-1' }, article)).toBe(false)
  })

  it('never matches two missing tenants against each other', () => {
    expect(canManageArticle({ role: 'admin', clientSiteId: null }, { clientSiteId: null })).toBe(false)
    expect(canManageArticle({ role: 'admin' }, {})).toBe(false)
  })
})

describe('dropBlankLines', () => {
  it('drops a break that only closes a block', () => {
    expect(dropBlankLines('<p>one<br></p><h2>two<br /></h2>')).toBe('<p>one</p><h2>two</h2>')
  })

  it('keeps a break that separates content', () => {
    const attribution = '<p><img src="/i.png" /><br><small>Zdroj: Openverse</small></p>'
    expect(dropBlankLines(attribution)).toBe(attribution)
  })

  it('drops paragraphs that are only a blank line', () => {
    expect(dropBlankLines('<p>a</p><p></p><p><br></p><p>&nbsp;</p><p style="x">  </p><p>b</p>')).toBe(
      '<p>a</p><p>b</p>',
    )
  })

  it('collapses a run of breaks, not just the last one', () => {
    expect(dropBlankLines('<p>a<br><br /> <br></p>')).toBe('<p>a</p>')
  })

  it('leaves a clean body untouched', () => {
    expect(dropBlankLines('<h2>t</h2><p>a</p><ul><li>b</li></ul>')).toBe('<h2>t</h2><p>a</p><ul><li>b</li></ul>')
  })
})

describe('isBlankArticle', () => {
  it('treats a fresh article as blank', () => {
    expect(isBlankArticle({ title: '', content: '' })).toBe(true)
  })

  it('treats TipTap’s emptied body as blank', () => {
    expect(isBlankArticle({ title: '', content: '<p></p>' })).toBe(true)
  })

  it('is not blank once there is a title', () => {
    expect(isBlankArticle({ title: 'Nuxt 4', content: '<p></p>' })).toBe(false)
  })

  it('is not blank once there is a body', () => {
    expect(isBlankArticle({ title: '', content: '<p>první věta</p>' })).toBe(false)
  })

  it('tolerates a missing body', () => {
    expect(isBlankArticle({ title: '' })).toBe(true)
    expect(isBlankArticle({ title: '', content: null })).toBe(true)
  })
})

describe('publishAction', () => {
  const now = new Date(2026, 7, 6, 14, 0)
  const later = new Date(2026, 7, 6, 15, 0)
  const earlier = new Date(2026, 7, 6, 13, 0)

  it('offers creation on an unsaved article', () => {
    expect(publishAction({ status: 'draft', releaseAt: null }, true, now)).toBe('createAndPublish')
  })

  it('offers immediate publication on a saved draft', () => {
    expect(publishAction({ status: 'draft', releaseAt: null }, false, now)).toBe('publishNow')
  })

  it('says it schedules when the release date is still ahead', () => {
    expect(publishAction({ status: 'draft', releaseAt: later }, true, now)).toBe('schedule')
    expect(publishAction({ status: 'draft', releaseAt: later }, false, now)).toBe('schedule')
  })

  it('publishes rather than schedules once the release date has passed', () => {
    expect(publishAction({ status: 'draft', releaseAt: earlier }, false, now)).toBe('publishNow')
  })

  it('degrades to a plain save once the article is published', () => {
    expect(publishAction({ status: 'published', releaseAt: null }, false, now)).toBe('saveChanges')
    // Still a save, not a re-schedule: the article is already out.
    expect(publishAction({ status: 'published', releaseAt: later }, false, now)).toBe('saveChanges')
  })

  it('accepts the datetime-local string the release picker produces', () => {
    expect(publishAction({ status: 'draft', releaseAt: '2026-08-06T15:00' }, false, now)).toBe('schedule')
    expect(publishAction({ status: 'draft', releaseAt: '2026-08-06T13:00' }, false, now)).toBe('publishNow')
  })
})
