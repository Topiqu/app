import { ScureBase32Plugin, createGuardrails, verifySync } from 'otplib'

const base32 = new ScureBase32Plugin()
// Existing v12 accounts have 10-byte secrets. Only verification retains that floor;
// new setups use v13's stronger 20-byte generateSecret() default.
const verificationGuardrails = createGuardrails({ MIN_SECRET_BYTES: 10 })

export const verifyTotpToken = (secret: string, token: string) => {
  if (!/^\d{6}$/.test(token) || !secret || secret.length > 104) return false
  let decoded: Uint8Array
  try {
    decoded = base32.decode(secret)
  } catch {
    return false
  }
  if (decoded.length < 10 || decoded.length > 64) return false
  return verifySync({ secret: decoded, token, epochTolerance: 0, guardrails: verificationGuardrails }).valid
}
