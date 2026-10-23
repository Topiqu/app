import type { WebsiteImportField, WebsiteImportResponse, WebsiteValues } from '~~/shared/utils/websiteImport'

export const useWebsiteImport = () => {
  const { data: auth } = useAuth()
  const can = useTenantScope()
  const mounted = useMounted()
  const visibility = useDocumentVisibility()
  const tenantId = computed(() => auth.value?.user.clientSiteId ?? '')
  const enabled = computed(() => !!tenantId.value && can('TENANT_SETTINGS'))
  const { data, pending, error, refresh } = useAsyncData<WebsiteImportResponse | null>(
    () => `website-import:${tenantId.value}`,
    () =>
      enabled.value
        ? $fetch<WebsiteImportResponse, '/api/website-import'>('/api/website-import')
        : Promise.resolve(null),
    { server: false, immediate: false, default: () => null },
  )
  watch(
    [mounted, enabled, tenantId],
    () => {
      if (mounted.value && enabled.value) void refresh({ dedupe: 'defer' })
    },
    { immediate: true },
  )
  const processing = computed(
    () =>
      enabled.value &&
      visibility.value === 'visible' &&
      ['PENDING', 'PROCESSING'].includes(data.value?.import?.status ?? ''),
  )
  const { pause, resume } = useIntervalFn(() => refresh({ dedupe: 'defer' }), 5000, { immediate: false })
  watch(processing, (active) => (active ? resume() : pause()), { immediate: true })
  const { invalidateClients } = useCacheInvalidation()
  const apply = async (fields: WebsiteImportField[], values: WebsiteValues) => {
    const job = data.value?.import
    if (!job) return
    await $fetch<{ acceptedFields: string[] }, '/api/website-import/:id/apply'>(
      `/api/website-import/${job.id}/apply` as '/api/website-import/:id/apply',
      {
        method: 'POST',
        body: { fields, values, expected: job.expected },
      },
    )
    await Promise.all([refresh(), invalidateClients(), refreshClientSite(), refreshClientSiteStatus()])
  }
  return { data, pending, error, refresh, apply, enabled }
}
