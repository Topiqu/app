// Only exception text is accepted here, never request/profile/token objects or stacks.
export function sanitizeAuthErrorMessage(message: string): string {
  let safe = message
  for (const key of ['AUTH_GITHUB_SECRET', 'AUTH_GOOGLE_SECRET', 'AUTH_SECRET', 'NUXT_AUTH_SECRET']) {
    const value = process.env[key]
    if (value) safe = safe.split(value).join('[redacted]')
  }
  return safe
    .replace(/https?:\/\/[^\s<>"']+/gi, '[url]')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[authorization]')
    .replace(
      /(["']?\b(?:access_token|refresh_token|id_token|client_secret|secret|password|code_verifier|csrfToken|state|code|token|cookie|authorization)\b["']?\s*(?:[:=]\s*|\s+))(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '$1[redacted]',
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, '[token]')
    .replace(/[A-Za-z0-9_+/=-]{32,}/g, '[opaque]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 600)
}
