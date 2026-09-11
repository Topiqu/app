/** Client credit units, independent of provider tokens. Prices are versioned at reservation time. */
export const TOKEN_PRICE_VERSION = '2026-09-wallet-v1'
export const TOKEN_LOW_BALANCE = 1000

export const walletSettlement = (reserved: number, actual: number) => {
  validateCreditAmount(reserved)
  if (!Number.isSafeInteger(actual) || actual < 0) throw new Error('Invalid token usage')
  const charged = Math.min(reserved, actual)
  return { charged, released: reserved - charged, absorbed: actual - charged }
}

export const validateCreditAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647)
    throw new Error('Credit must be a positive 32-bit integer')
  return amount
}
