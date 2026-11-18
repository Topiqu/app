import * as cheerio from 'cheerio'
import { isChartKind } from '~~/shared/utils/articleChart'
import { isCalloutTone } from '~~/shared/utils/articleEmbeds'

const HEADINGS = 'h1, h2, h3, h4, h5, h6'

const isProsConsSide = ($side: cheerio.Cheerio<any>) => {
  const children = $side.children()
  return (
    children.length === 2 &&
    children.eq(0).is('p') &&
    children.eq(1).is('ul') &&
    children.eq(1).children('li').length > 0
  )
}

/**
 * Keeps the callouts, pros/cons blocks and chart marks the writer authored only in the shape the editor and
 * the page understand. Anything else is unwrapped to its content, so a malformed block reads as plain text.
 */
export const normalizeBodyBlocks = (html: string) => {
  const $ = cheerio.load(html, null, false)

  $('aside').each((_, el) => {
    const $el = $(el)
    if ($el.attr('data-type') !== 'callout') return void $el.replaceWith($el.contents())
    // A heading inside would join the article outline; the editor schema has no place for one either.
    $el.find(HEADINGS).each((_, heading) => void $(heading).replaceWith(`<p>${$(heading).html() ?? ''}</p>`))
    if (!isCalloutTone($el.attr('data-tone'))) $el.attr('data-tone', 'note')
    if (!$el.text().trim()) $el.remove()
  })

  $('[data-type="pros-cons"]').each((_, el) => {
    const $el = $(el)
    const $sides = $el.children('[data-side]')
    const valid =
      $el.is('div') &&
      $el.children().length === 2 &&
      $sides.eq(0).attr('data-side') === 'pros' &&
      $sides.eq(1).attr('data-side') === 'cons' &&
      isProsConsSide($sides.eq(0)) &&
      isProsConsSide($sides.eq(1))
    if (!valid) $el.replaceWith($sides.length ? $sides.contents() : $el.contents())
  })

  // CTAs are the author's call: one the writer emits would link wherever the model chose.
  $('[data-type="cta"]').remove()

  $('table[data-chart]').each((_, el) => {
    if (!isChartKind($(el).attr('data-chart'))) $(el).removeAttr('data-chart')
  })

  return $.html()
}
