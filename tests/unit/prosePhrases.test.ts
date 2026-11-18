import { describe, expect, it } from 'vitest'

import { prosePhrases } from '../eval/prosePhrases'

describe('eval prose phrase candidates', () => {
  it('finds repeated constructions across markup without deduplicating their occurrences', () => {
    const html = '<p>Je <strong>důležité</strong> si uvědomit rozdíl.</p><p>Je důležité uchovat doklad.</p>'
    expect(prosePhrases(html).map((match) => match.category)).toEqual(['importance', 'importance'])
    expect(prosePhrases(html)).toEqual(prosePhrases(html))
  })

  it('does not classify direct answers, conditions or concrete actions as empty advice', () => {
    expect(prosePhrases('PEFC nestačí. Pokud objednávku rozdělíte, evidujte každou dodávku zvlášť.')).toEqual([])
  })

  it('marks a corrective construction for contextual inspection without rewriting the text', () => {
    const text = 'Výroba sama o sobě nerozhoduje.'
    expect(prosePhrases(text)).toEqual([{ category: 'correction', phrase: 'sama o sobě nerozhoduje', offset: 7 }])
  })

  it('preserves the accented masculine form in a corrective construction', () => {
    expect(prosePhrases('Rok těžby sám o sobě nerozhodne.')).toEqual([
      { category: 'correction', phrase: 'sám o sobě nerozhodne', offset: 10 },
    ])
  })
})
