import type Stripe from 'stripe'

import { describe, expect, it } from 'vitest'

import { toBillingInvoice } from '../../../server/utils/stripeInvoices'

describe('toBillingInvoice', () => {
  it('returns only the customer-facing invoice fields', () => {
    const invoice = {
      id: 'in_123',
      number: 'INV-0042',
      status: 'paid',
      created: 1_754_582_400,
      total: 4900,
      currency: 'usd',
      hosted_invoice_url: 'https://invoice.stripe.com/i/acct_test/in_123',
      invoice_pdf: 'https://pay.stripe.com/invoice/acct_test/in_123/pdf',
      customer_email: 'private@example.com',
    } as Stripe.Invoice

    expect(toBillingInvoice(invoice)).toEqual({
      id: 'in_123',
      number: 'INV-0042',
      status: 'paid',
      createdAt: '2025-08-07T16:00:00.000Z',
      amount: 4900,
      currency: 'USD',
      hostedUrl: 'https://invoice.stripe.com/i/acct_test/in_123',
      pdfUrl: 'https://pay.stripe.com/invoice/acct_test/in_123/pdf',
    })
  })
})
