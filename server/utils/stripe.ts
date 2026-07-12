import Stripe from 'stripe'

let client: Stripe | undefined

export function useStripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SK
    if (!secretKey) {
      throw createError({ statusCode: 500, message: 'Missing STRIPE_SK env' })
    }
    client = new Stripe(secretKey, { apiVersion: '2025-08-27.basil' })
  }
  return client
}
