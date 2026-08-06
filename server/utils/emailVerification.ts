export const RESEND_THROTTLE_MS = 60 * 1000

export const VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000

interface VerificationCandidate {
  emailVerified: boolean
  verification?: { createdAt: Date } | null
}

export const shouldIssueVerificationCode = (user: VerificationCandidate | null, now: number = Date.now()): boolean => {
  if (!user || user.emailVerified) return false

  const issuedAt = user.verification?.createdAt
  if (!issuedAt) return true

  return now - issuedAt.getTime() >= RESEND_THROTTLE_MS
}
