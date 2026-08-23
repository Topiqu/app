export type BillingInvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'

export interface BillingInvoice {
  id: string
  number: string | null
  status: BillingInvoiceStatus | null
  createdAt: string
  amount: number
  currency: string
  hostedUrl: string | null
  pdfUrl: string | null
}
