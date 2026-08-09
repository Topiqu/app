import type Stripe from 'stripe'
import type { BillingInvoice } from '~~/shared/types/billing'

export function toBillingInvoice(invoice: Stripe.Invoice): BillingInvoice {
  return {
    id: invoice.id!,
    number: invoice.number ?? null,
    status: invoice.status ?? null,
    createdAt: new Date(invoice.created * 1000).toISOString(),
    amount: invoice.total,
    currency: invoice.currency.toUpperCase(),
    hostedUrl: invoice.hosted_invoice_url ?? null,
    pdfUrl: invoice.invoice_pdf ?? null,
  }
}
