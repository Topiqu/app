// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { toBillingInvoice } from '../../../server/utils/stripeInvoices'

const { requests } = vi.hoisted(() => ({ requests: [] as Array<{ url: string; init: RequestInit }> }))
vi.mock('stripe', async (original) => {
  const { default: ActualStripe } = await original<typeof import('stripe')>()
  return {
    default: class extends ActualStripe {
      constructor(key: string, options: ConstructorParameters<typeof ActualStripe>[1]) {
        super(key, {
          ...options,
          httpClient: ActualStripe.createFetchHttpClient(async (input, init) => {
            requests.push({ url: String(input), init: init ?? {} })
            return new Response(
              JSON.stringify(
                String(input).includes('/invoices')
                  ? {
                      object: 'list',
                      has_more: false,
                      data: [
                        {
                          id: 'in_basil',
                          object: 'invoice',
                          number: '2026-01',
                          status: 'paid',
                          created: 1_234_567_890,
                          total: 1900,
                          currency: 'czk',
                          hosted_invoice_url: 'https://billing.invalid/invoice',
                          invoice_pdf: null,
                        },
                      ],
                    }
                  : { id: 'cs_basil', object: 'checkout.session', url: 'https://checkout.invalid/session' },
              ),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          }),
        })
      }
    },
  }
})

afterEach(() => {
  requests.length = 0
  vi.unstubAllEnvs()
})

describe('Stripe SDK preserves the deployed Basil API', () => {
  it('sends the existing checkout version, metadata and idempotency key through its actual transport', async () => {
    vi.stubEnv('STRIPE_SK', 'sk_test_synthetic')
    const { useStripe } = await import('../../../server/utils/stripe')
    const result = await useStripe().checkout.sessions.create(
      {
        mode: 'subscription',
        client_reference_id: 'tenant_fixture',
        line_items: [{ price: 'price_fixture', quantity: 1 }],
        success_url: 'https://tenant.invalid/en/billing',
        cancel_url: 'https://tenant.invalid/en/billing',
        metadata: { clientSiteId: 'tenant_fixture', plan: 'PRO', interval: 'month' },
        subscription_data: { metadata: { clientSiteId: 'tenant_fixture', plan: 'PRO', interval: 'month' } },
      },
      { idempotencyKey: 'subscription:tenant_fixture:123' },
    )
    expect(result.url).toBe('https://checkout.invalid/session')
    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe('https://api.stripe.com/v1/checkout/sessions')
    const headers = new Headers(requests[0]!.init.headers)
    expect(headers.get('stripe-version')).toBe('2025-08-27.basil')
    expect(headers.get('idempotency-key')).toBe('subscription:tenant_fixture:123')
    const body = new URLSearchParams(String(requests[0]!.init.body))
    expect(body.get('metadata[clientSiteId]')).toBe('tenant_fixture')
    expect(body.get('subscription_data[metadata][plan]')).toBe('PRO')
    expect(body.get('line_items[0][price]')).toBe('price_fixture')
  })

  it('reads the existing bounded invoice response into the public billing DTO', async () => {
    vi.stubEnv('STRIPE_SK', 'sk_test_synthetic')
    const { useStripe } = await import('../../../server/utils/stripe')
    const result = await useStripe().invoices.list({ customer: 'cus_fixture', limit: 12 })
    expect(result.data.map(toBillingInvoice)).toEqual([
      {
        id: 'in_basil',
        number: '2026-01',
        status: 'paid',
        createdAt: '2009-02-13T23:31:30.000Z',
        amount: 1900,
        currency: 'CZK',
        hostedUrl: 'https://billing.invalid/invoice',
        pdfUrl: null,
      },
    ])
    expect(new URL(requests[0]!.url).searchParams.get('limit')).toBe('12')
    expect(new Headers(requests[0]!.init.headers).get('stripe-version')).toBe('2025-08-27.basil')
  })
})
