// Settings shows the import card only while an import needs the user; a re-run starts from the page header.
export const useWebsiteImportCard = () => {
  const { data, error, enabled } = useWebsiteImport()
  const { data: status } = useClientSiteStatus()
  const can = useTenantScope()
  const rerun = useState('website-import-rerun', () => false)
  const canStart = computed(() => hasAiPlan(status.value?.plan))
  // Reviewing is where the settings work ends, so the next step is the first article, not more settings.
  const firstArticle = computed(
    () => canStart.value && status.value?.setup?.hasDraft === false && can('AI_USE') && can('ARTICLE_WRITE'),
  )
  const open = computed(() => {
    const state = data.value?.import?.status
    if (!enabled.value) return false
    if (error.value || (rerun.value && canStart.value)) return true
    return !!state && (state !== 'REVIEWED' || firstArticle.value)
  })
  return { open, rerun, canStart, firstArticle }
}
