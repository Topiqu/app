export const databaseErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined
  if ('dbErrorCode' in error && error.dbErrorCode != null) return String(error.dbErrorCode)
  if ('cause' in error) return databaseErrorCode(error.cause)
  return undefined
}

export const databaseErrorMessage = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return ''
  if ('dbErrorMessage' in error && typeof error.dbErrorMessage === 'string') return error.dbErrorMessage
  if ('cause' in error) return databaseErrorMessage(error.cause)
  return error instanceof Error ? error.message : ''
}

export const isUniqueViolation = (error: unknown): boolean => databaseErrorCode(error) === '23505'
