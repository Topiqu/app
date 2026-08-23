import { describe, expect, it } from 'vitest'

import {
  AI_FORMATS,
  canManageArticle,
  composeAiPrompt,
  countHtmlWords,
  dropBlankLines,
  formatElapsed,
  isBlankArticle,
  publishAction,
  releaseQuickValue,
  tagTriggerLabel,
  toDateTimeLocal,
  wrapIndex,
} from '../../shared/utils/articleEditor'

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

describe('composeAiPrompt', () => {
  it('returns the bare topic when no format is selected', () => {
    expect(composeAiPrompt('  Nuxt 4 migration  ')).toBe('Nuxt 4 migration')
    expect(composeAiPrompt('Nuxt 4 migration', null)).toBe('Nuxt 4 migration')
  })

  it('prefixes the topic with the selected format template', () => {
    expect(composeAiPrompt('Nuxt 4 migration', 'Write a practical step-by-step guide about:')).toBe(
      'Write a practical step-by-step guide about: Nuxt 4 migration',
    )
  })

  it('never emits a dangling separator when one side is empty', () => {
    expect(composeAiPrompt('', 'Write a news report about:')).toBe('Write a news report about:')
    expect(composeAiPrompt('   ', '   ')).toBe('')
  })

  it('exposes a stable, non-empty format list', () => {
    expect(AI_FORMATS.length).toBeGreaterThan(0)
    expect(new Set(AI_FORMATS).size).toBe(AI_FORMATS.length)
  })
})

describe('countHtmlWords', () => {
  it('counts words in streamed markup, not tags', () => {
    expect(countHtmlWords('<h2>Hello there</h2><p>Three more words</p>')).toBe(5)
  })

  it('treats entities and whitespace as separators', () => {
    expect(countHtmlWords('<p>one&nbsp;two</p>\n\n<p>  three  </p>')).toBe(3)
  })

  it('ignores script and style content', () => {
    expect(countHtmlWords('<style>.a{color:red}</style><p>only this</p>')).toBe(2)
  })

  it('handles empty input', () => {
    expect(countHtmlWords('')).toBe(0)
    expect(countHtmlWords(null)).toBe(0)
    expect(countHtmlWords(undefined)).toBe(0)
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

describe('formatElapsed', () => {
  it('formats as m:ss with a zero-padded seconds field', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(9_400)).toBe('0:09')
    expect(formatElapsed(65_000)).toBe('1:05')
    expect(formatElapsed(600_000)).toBe('10:00')
  })

  it('clamps negative drift to zero', () => {
    expect(formatElapsed(-5_000)).toBe('0:00')
  })
})

describe('toDateTimeLocal', () => {
  it('returns null for empty values', () => {
    expect(toDateTimeLocal(null)).toBeNull()
    expect(toDateTimeLocal(undefined)).toBeNull()
    expect(toDateTimeLocal('')).toBeNull()
  })

  it('truncates an existing input string to minute precision', () => {
    expect(toDateTimeLocal('2026-08-06T14:05:33.000Z')).toBe('2026-08-06T14:05')
  })

  it('renders a Date in local time, not UTC', () => {
    const date = new Date(2026, 7, 6, 14, 5)
    expect(toDateTimeLocal(date)).toBe('2026-08-06T14:05')
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

describe('tagTriggerLabel', () => {
  it('is empty with no tags, so the caller can fall back to its placeholder', () => {
    expect(tagTriggerLabel([])).toBe('')
  })

  it('spells out names up to the limit', () => {
    expect(tagTriggerLabel(['Vue'])).toBe('Vue')
    expect(tagTriggerLabel(['Vue', 'Nuxt'])).toBe('Vue, Nuxt')
  })

  it('counts the overflow instead of growing', () => {
    expect(tagTriggerLabel(['Vue', 'Nuxt', 'TypeScript'])).toBe('Vue, Nuxt +1')
    expect(tagTriggerLabel(['a', 'b', 'c', 'd', 'e'])).toBe('a, b +3')
  })

  it('honours a different name budget', () => {
    expect(tagTriggerLabel(['Vue', 'Nuxt', 'TypeScript'], 1)).toBe('Vue +2')
    expect(tagTriggerLabel(['Vue', 'Nuxt', 'TypeScript'], 3)).toBe('Vue, Nuxt, TypeScript')
  })
})

describe('wrapIndex', () => {
  it('steps forward and backward', () => {
    expect(wrapIndex(0, 1, 3)).toBe(1)
    expect(wrapIndex(2, -1, 3)).toBe(1)
  })

  it('wraps at both ends', () => {
    expect(wrapIndex(2, 1, 3)).toBe(0)
    expect(wrapIndex(0, -1, 3)).toBe(2)
  })

  it('stays in range for deltas larger than the list', () => {
    expect(wrapIndex(0, -5, 3)).toBe(1)
    expect(wrapIndex(0, 7, 3)).toBe(1)
  })

  it('collapses to zero on an empty list', () => {
    expect(wrapIndex(4, 1, 0)).toBe(0)
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

describe('releaseQuickValue', () => {
  const from = new Date(2026, 7, 6, 14, 5, 33)

  it('clears the release date', () => {
    expect(releaseQuickValue('clear', from)).toBeNull()
  })

  it('drops seconds so the datetime-local input round-trips', () => {
    expect(releaseQuickValue('now', from)).toBe('2026-08-06T14:05')
  })

  it('adds an hour', () => {
    expect(releaseQuickValue('inHour', from)).toBe('2026-08-06T15:05')
  })

  it('moves to 8:00 the next day', () => {
    expect(releaseQuickValue('tomorrow', from)).toBe('2026-08-07T08:00')
  })

  it('does not mutate the source date', () => {
    const source = new Date(2026, 7, 6, 14, 5, 33)
    releaseQuickValue('tomorrow', source)
    expect(source.getDate()).toBe(6)
    expect(source.getSeconds()).toBe(33)
  })
})
