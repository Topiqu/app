import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('token top-up accounting', () => {
  it('adds purchased tokens to capacity and balance without recording them as consumption', () => {
    const source = readFileSync('server/api/stripe/webhook.ts', 'utf8')
    const topUp = source.slice(
      source.indexOf('const tokens = Number(session.metadata?.tokens ?? 0)'),
      source.indexOf("if (stripeEvent.type === 'customer.subscription.updated')"),
    )

    expect(topUp).toContain('tokenLimit: { increment: tokens }')
    expect(topUp).toContain('tokenRemaining: { increment: tokens }')
    expect(topUp).not.toContain('totalUsage')
  })
})
