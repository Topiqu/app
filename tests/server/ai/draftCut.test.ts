import { describe, expect, it } from 'vitest'

import { slotCounts, salvageBody, cutUnfinished } from '../../../server/utils/ai/draftCut'

const section = (heading: string) =>
  `<h2>${heading}</h2><p>${'Teplý vzduch rozvedou kamna až do tří dalších místností. '.repeat(6)}</p>`

describe('cut draft', () => {
  it('drops the unfinished last block and a heading left without text', () => {
    expect(cutUnfinished('<h2>Cena</h2><p>Hotový odstavec.</p><h2>Instalace</h2><p>Rozepsa')).toBe(
      '<h2>Cena</h2><p>Hotový odstavec.</p>',
    )
    expect(cutUnfinished('<h2>Cena</h2><p>Hotový &amp; odstavec.</p>\n[[IMAGE2')).toBe(
      '<h2>Cena</h2><p>Hotový &amp; odstavec.</p>',
    )
  })

  it('counts each slot kind the body uses', () => {
    expect(slotCounts('<p>[[IMAGE1]]</p><p>[[IMAGE3]]</p>[[POLL1]]')).toEqual({ IMAGE: 3, POLL: 1, VIDEO: 0, XPOST: 0 })
  })

  it('finishes a body with two sections and keeps a body the writer had already closed', () => {
    const written = section('Rozvod tepla') + section('Výkon')
    expect(
      salvageBody({ title: 'Peletová kamna', perex: 'Perex', content: `${written}<h2>Údržba</h2><p>Čiš` }),
    ).toEqual({ title: 'Peletová kamna', perex: 'Perex', content: written })
    expect(salvageBody({ title: 'Peletová kamna', perex: 'Perex', content: written, answer: '' })?.content).toBe(
      written,
    )
  })

  it('gives up on a body too short to finish', () => {
    expect(salvageBody({ title: 'Peletová kamna', content: `${section('Jediný oddíl')}<p>Roz` })).toBeNull()
    expect(salvageBody({ content: section('A') + section('B') })).toBeNull()
  })
})
