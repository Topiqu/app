/** The translation key for why a queued import waits or a failed one stopped; null when the code has no copy. */
export const websiteImportReason = (job: Pick<WebsiteImportView, 'status' | 'errorCode'>) => {
  const code = job.errorCode ?? ''
  if (job.status === 'PENDING' && (WEBSITE_IMPORT_WAIT_CODES as readonly string[]).includes(code))
    return code === 'DAILY_BUDGET' ? 'common.websiteImport.budgetWait' : `common.websiteImport.waiting.${code}`
  if (job.status === 'FAILED' && (WEBSITE_IMPORT_ERROR_CODES as readonly string[]).includes(code))
    return `common.websiteImport.errors.${code}`
  return null
}
