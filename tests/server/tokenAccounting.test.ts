import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { tokenDebit } from '../../server/utils/consumeTokens'

describe('token accounting', () => {
  it('debits a covered charge without changing capacity semantics', () => {
    expect(tokenDebit(25_000, 4_000)).toEqual({ remaining: 21_000, debited: 4_000, fullyCovered: true })
  })

  it('clamps an over-budget completion at zero', () => {
    expect(tokenDebit(1_500, 4_000)).toEqual({ remaining: 0, debited: 1_500, fullyCovered: false })
  })

  it('normalizes historical negative and null balances', () => {
    expect(tokenDebit(-16_191, 500)).toEqual({ remaining: 0, debited: 0, fullyCovered: false })
    expect(tokenDebit(null, 0)).toEqual({ remaining: 0, debited: 0, fullyCovered: true })
  })

  it('ships a database backstop and repairs historical balances', () => {
    const migration = readFileSync('prisma/migrations/20260831113000_token_capacity_invariant/migration.sql', 'utf8')

    expect(migration).toContain('GREATEST(COALESCE("tokenRemaining", 0), 0)')
    expect(migration).toContain('"tokenRemaining" <= "tokenLimit"')
    expect(migration).toContain('ClientSite_tokenRemaining_nonnegative')
  })
})
