import { createHash, randomBytes } from 'node:crypto'

export const invitationToken = () => randomBytes(32).toString('base64url')
export const invitationTokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const invitationEmail = (email: string) => email.trim().toLowerCase()
export const invitationUrl = (event: Parameters<typeof getRequestURL>[0], token: string, language = 'en') =>
  `${getRequestURL(event).origin}/${language === 'cs' ? 'cs' : 'en'}/invitation/${encodeURIComponent(token)}`
