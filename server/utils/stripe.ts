import Stripe from 'stripe'

let client: Stripe | undefined

export function useStripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SK
    if (!secretKey) {
      throw createError({ statusCode: 500, message: 'Missing STRIPE_SK env' })
    }
    // Preserve the deployed billing/webhook contract; upgrading the SDK must not upgrade the API.
    // Stripe types describe its newest API, so compatibility is also checked with Basil fixtures.
    client = new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion })
  }
  return client
}
