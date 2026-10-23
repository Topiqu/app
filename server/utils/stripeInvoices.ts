import type Stripe from 'stripe'
import type { BillingInvoice, BillingInvoiceStatus } from '~~/shared/types/billing'

const isInvoiceStatus = (status: unknown): status is BillingInvoiceStatus =>
  status === 'draft' || status === 'open' || status === 'paid' || status === 'uncollectible' || status === 'void'

export function toBillingInvoice(invoice: Stripe.Invoice): BillingInvoice {
  return {
    id: invoice.id!,
    number: invoice.number ?? null,
    status: isInvoiceStatus(invoice.status) ? invoice.status : null,
    createdAt: new Date(invoice.created * 1000).toISOString(),
    amount: invoice.total,
    currency: invoice.currency.toUpperCase(),
    hostedUrl: invoice.hosted_invoice_url ?? null,
    pdfUrl: invoice.invoice_pdf ?? null,
  }
}
