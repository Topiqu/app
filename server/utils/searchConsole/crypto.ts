import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const key = () => {
  const value = process.env.GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY
  if (!value) throw new Error('GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY is not configured')
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length !== 32) throw new Error('GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY must be 32 bytes encoded as base64')
  return decoded
}

export const encryptSearchConsoleToken = (plain: string): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export const decryptSearchConsoleToken = (value: string): string => {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part!, 'base64url'))
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted Search Console token')
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
