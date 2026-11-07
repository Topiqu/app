export const useWebsiteImport = createSharedComposable(() => {
  const { data: auth } = useAuth()
  const can = useTenantScope()
  const mounted = useMounted()
  const visibility = useDocumentVisibility()
  const tenantId = computed(() => auth.value?.user.clientSiteId ?? '')
  const enabled = computed(() => !!tenantId.value && can('TENANT_SETTINGS'))
  const request = createAsyncDataRequest((signal) =>
    enabled.value
      ? $fetch<WebsiteImportResponse, '/api/website-import'>('/api/website-import', { signal })
      : Promise.resolve(null),
  )
  onScopeDispose(request.dispose)
  const { data, pending, error, refresh } = useAsyncData<WebsiteImportResponse | null>(
    () => `website-import:${tenantId.value}`,
    request.fetch,
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
  // A running import reports each step, so it is polled faster than a queued one.
  const { pause, resume } = useIntervalFn(
    () => refresh({ dedupe: 'defer' }),
    () => (data.value?.import?.status === 'PROCESSING' ? 2000 : 5000),
    { immediate: false },
  )
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
  const start = async (url: string) => {
    await $fetch<{ id: string }, '/api/website-import'>('/api/website-import', {
      method: 'POST',
      body: { url, consentVersion: WEBSITE_IMPORT_CONSENT_VERSION },
    })
    await refresh()
  }
  return { data, pending, error, refresh, apply, start, enabled }
})

/** First-article ideas from the latest import; empty for imports that predate them. */
export const useWebsiteTopics = () => {
  const { data } = useWebsiteImport()
  return computed(() => data.value?.import?.result?.topics ?? [])
}
