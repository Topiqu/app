/** The apply endpoint's refusals, shared by the settings review and the setup checklist. */
export const websiteImportApplyMessage = (error: unknown, t: (key: string) => string) => {
  const detail = error as {
    data?: { data?: { code?: string; field?: string }; statusCode?: number }
    statusCode?: number
  }
  const code = detail.data?.data?.code
  if (code === 'WEBSITE_CONFLICT') return t('common.websiteImport.conflict')
  if (code === 'WEBSITE_ASSET') return t('common.websiteImport.assetFailed')
  if (detail.statusCode === 429 || detail.data?.statusCode === 429) return t('common.websiteImport.rateLimited')
  return t('common.websiteImport.failedHelp')
}
