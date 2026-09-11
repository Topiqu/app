import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('token top-up accounting', () => {
  it('credits only paid checkout sessions with a stable session idempotency key', () => {
    const source = readFileSync('server/api/stripe/webhook.ts', 'utf8')
    const topUp = source.slice(
      source.indexOf('const tokens = Number(session.metadata?.tokens ?? 0)'),
      source.indexOf("if (stripeEvent.type === 'customer.subscription.updated')"),
    )

    expect(topUp).toContain('await creditTokens(')
    expect(topUp).toContain("session.payment_status === 'paid'")
    expect(topUp).toContain('stripe:checkout:${session.id}')
    expect(source).toContain('checkout.session.async_payment_succeeded')
    expect(topUp).not.toContain('tokenLimit')
    expect(topUp).not.toContain('totalUsage')
  })
})
