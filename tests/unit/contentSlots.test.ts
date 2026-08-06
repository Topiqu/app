import { describe, expect, it } from 'vitest'

import { applyContentSlots, replaceSlot } from '../../shared/utils/contentSlots'

const img = (n: number) => `<p><img src="/i${n}.png" /></p>`

describe('applyContentSlots', () => {
  it('swaps markers for their matching html', () => {
    const out = applyContentSlots('<p>a</p>[[IMAGE1]]<p>b</p>[[IMAGE2]]', 'IMAGE', [
      { slot: 1, html: img(1) },
      { slot: 2, html: img(2) },
    ])
    expect(out).toBe(`<p>a</p>${img(1)}<p>b</p>${img(2)}`)
  })

  it('tolerates whitespace and casing the model may emit', () => {
    const out = applyContentSlots('[[ image 1 ]] and [[Image2]]', 'IMAGE', [
      { slot: 1, html: img(1) },
      { slot: 2, html: img(2) },
    ])
    expect(out).toBe(`${img(1)} and ${img(2)}`)
  })

  it('appends images whose marker the model never wrote instead of dropping them', () => {
    const out = applyContentSlots('<p>no markers at all</p>', 'IMAGE', [
      { slot: 1, html: img(1) },
      { slot: 2, html: img(2) },
    ])
    expect(out).toContain(img(1))
    expect(out).toContain(img(2))
    expect(out.startsWith('<p>no markers at all</p>')).toBe(true)
  })

  it('appends only the orphans, keeping matched ones in place', () => {
    const out = applyContentSlots('<p>a</p>[[IMAGE2]]', 'IMAGE', [
      { slot: 1, html: img(1) },
      { slot: 2, html: img(2) },
    ])
    expect(out).toBe(`<p>a</p>${img(2)}\n${img(1)}`)
  })

  it('strips markers that have no image so raw placeholders never ship', () => {
    const out = applyContentSlots('<p>a</p>[[IMAGE3]]<p>b</p>', 'IMAGE', [{ slot: 1, html: img(1) }])
    expect(out).not.toContain('[[')
    expect(out).toContain(img(1))
  })

  it('strips every marker when there is nothing to insert', () => {
    expect(applyContentSlots('<p>a</p>[[POLL1]][[POLL2]]', 'POLL', [])).toBe('<p>a</p>')
  })

  it('leaves other slot kinds untouched', () => {
    const out = applyContentSlots('[[IMAGE1]][[POLL1]]', 'IMAGE', [{ slot: 1, html: img(1) }])
    expect(out).toBe(`${img(1)}[[POLL1]]`)
  })

  it('handles repeated markers for the same slot', () => {
    const out = applyContentSlots('[[IMAGE1]]x[[IMAGE1]]', 'IMAGE', [{ slot: 1, html: img(1) }])
    expect(out).toBe(`${img(1)}x${img(1)}`)
  })
})

describe('replaceSlot', () => {
  it('replaces only the requested slot', () => {
    expect(replaceSlot('[[IMAGE1]][[IMAGE2]]', 'IMAGE', 2, img(2))).toBe(`[[IMAGE1]]${img(2)}`)
  })

  it('tolerates whitespace and casing', () => {
    expect(replaceSlot('[[ Image 1 ]]', 'IMAGE', 1, img(1))).toBe(img(1))
  })

  it('is a no-op when the marker has not streamed in yet', () => {
    expect(replaceSlot('<p>partial</p>', 'IMAGE', 1, img(1))).toBe('<p>partial</p>')
  })

  it('does not match a different slot number with the same prefix', () => {
    expect(replaceSlot('[[IMAGE12]]', 'IMAGE', 1, img(1))).toBe('[[IMAGE12]]')
  })
})
