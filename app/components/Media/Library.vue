<template>
  <div class="flex min-h-0 flex-col gap-4" :aria-busy="loading">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <UFormField :label="$t('media.search')" :ui="{ label: 'sr-only' }" class="min-w-0 flex-1">
        <UInput v-model="search" type="search" icon="mdi:magnify" :placeholder="$t('media.search')" class="w-full" />
      </UFormField>
      <USelect v-model="origin" :items="originItems" :aria-label="$t('media.allOrigins')" class="w-full sm:w-48" />
      <USelect v-model="usage" :items="usageItems" :aria-label="$t('media.allUsage')" class="w-full sm:w-40" />
      <USwitch
        v-model="archived"
        :label="$t('media.showArchived')"
        :aria-label="$t('media.showArchived')"
        class="shrink-0"
      />
      <slot name="actions" />
    </div>

    <UAlert
      v-if="loadError && !items.length"
      color="error"
      variant="soft"
      icon="mdi:alert-circle-outline"
      :title="$t('common.messages.loadFailedTitle')"
      :description="$t('common.messages.loadFailedText')"
    >
      <template #actions>
        <UButton color="error" variant="soft" icon="mdi:refresh" @click="reload">{{
          $t('common.messages.retry')
        }}</UButton>
      </template>
    </UAlert>

    <div
      v-else-if="loading && !items.length"
      class="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5 lg:grid-cols-6 xl:grid-cols-8"
    >
      <div v-for="index in 16" :key="index" class="overflow-hidden rounded-md">
        <USkeleton class="aspect-square w-full" />
      </div>
    </div>

    <UEmpty
      v-else-if="!items.length"
      icon="mdi:image-off-outline"
      :title="$t('media.empty')"
      :description="$t('media.emptyDescription')"
    />

    <div v-else class="flex flex-col gap-6">
      <section v-for="group in groups" :key="group.key" :aria-labelledby="`${instanceId}-${group.key}`">
        <h2 :id="`${instanceId}-${group.key}`" class="mb-2 text-sm font-semibold text-highlighted">
          {{ group.label }}
        </h2>
        <div class="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5 lg:grid-cols-6 xl:grid-cols-8">
          <article
            v-for="asset in group.items"
            :key="asset.id"
            class="group relative cursor-pointer overflow-hidden rounded-md border bg-default transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="
              selectedId === asset.id
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-transparent hover:border-primary/50'
            "
            role="button"
            tabindex="0"
            :title="asset.name || asset.originalFilename || undefined"
            :aria-label="asset.name || asset.originalFilename || $t('media.use')"
            @click="activate(asset)"
            @keydown.enter.prevent="activate(asset)"
            @keydown.space.prevent="activate(asset)"
          >
            <AppMedia
              :src="asset.deliveryUrl || asset.url"
              :originalSrc="asset.url"
              :alt="asset.defaultAltText || asset.name || asset.originalFilename || ''"
              aspectRatio="1 / 1"
              sizes="xs:33vw phone:33vw sm:25vw lg:16vw xl:160px"
              containerClass="w-full"
            />
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2 pt-6 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <p class="truncate font-medium">{{ asset.name || asset.originalFilename || asset.id }}</p>
              <p class="truncate">{{ $t(`media.origins.${asset.origin}`) }}</p>
            </div>
            <span
              v-if="asset.usageCount"
              class="pointer-events-none absolute bottom-1 right-1 rounded-sm bg-black/70 px-1.5 text-xs tabular-nums text-white"
              :title="$t('media.usageCount', { count: asset.usageCount })"
            >
              {{ asset.usageCount }}
            </span>
            <!-- Outside the picker a tap already opens the detail, and on a phone this button hides much of the tile. -->
            <UButton
              v-if="selectable"
              class="absolute right-1 top-1 z-10"
              color="neutral"
              variant="overlay"
              size="xs"
              square
              icon="mdi:information-outline"
              :aria-label="$t('media.details')"
              @click.stop="$emit('inspect', asset.id)"
            />
          </article>
        </div>
      </section>
    </div>

    <div v-if="items.length && hasMore" ref="sentinel" class="flex flex-col items-center gap-2 pt-2">
      <UButton color="neutral" variant="soft" :loading="loading" :disabled="loading" @click="loadMore">
        {{ $t('media.loadMore') }}
      </UButton>
      <p class="text-xs text-muted">
        {{ $t('media.pagination', { from: 1, to: items.length, total }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MediaLibraryAsset } from '~~/shared/types/mediaLibrary'

const { selectable = false, selectedId = null } = defineProps<{ selectable?: boolean; selectedId?: string | null }>()
const emit = defineEmits<{ select: [asset: MediaLibraryAsset]; inspect: [id: string] }>()
const { t, locale } = useI18n()
const requestFetch = useRequestFetch()
const { data: auth } = useAuth()
const instanceId = useId()
const scopeKey = computed(() => `${auth.value?.user.id ?? ''}:${auth.value?.user.clientSiteId ?? ''}`)
const search = shallowRef('')
const debouncedSearch = refDebounced(search, 350)
const origin = shallowRef('all')
const usage = shallowRef('all')
const archived = shallowRef(false)
const page = shallowRef(1)
const pageSize = 30
const loaded = shallowRef<MediaLibraryAsset[]>([])
const total = shallowRef(0)

watch([debouncedSearch, origin, usage, archived], () => (page.value = 1), { flush: 'sync' })
watch(
  scopeKey,
  () => {
    loaded.value = []
    total.value = 0
    page.value = 1
  },
  { flush: 'sync' },
)

const originItems = computed(() => [
  { label: t('media.allOrigins'), value: 'all' },
  ...MEDIA_ORIGINS.map((value) => ({ label: t(`media.origins.${value}`), value })),
])
const usageItems = computed(() => [
  { label: t('media.allUsage'), value: 'all' },
  { label: t('media.used'), value: 'used' },
  { label: t('media.unused'), value: 'unused' },
])
const query = computed(() => ({
  ...(debouncedSearch.value ? { query: debouncedSearch.value } : {}),
  ...(origin.value !== 'all' ? { origin: origin.value } : {}),
  usage: usage.value,
  archived: archived.value,
  page: page.value,
  limit: pageSize,
}))
const key = computed(() => `media-library:${instanceId}:${scopeKey.value}`)
const fetchPage = (number: number, signal: AbortSignal) =>
  requestFetch<MediaLibraryPage>('/api/media', { query: { ...query.value, page: number }, signal })
// A reload refetches everything scrolled so far, so editing an old image does not jump back to the top.
let reloadPages = 1
const request = createAsyncDataRequest(async (signal) => {
  const count = reloadPages
  reloadPages = 1
  if (count === 1) return fetchPage(page.value, signal)
  const pages = await Promise.all(Array.from({ length: count }, (_, index) => fetchPage(index + 1, signal)))
  return { ...pages.at(-1)!, page: 1, items: pages.flatMap((item) => item.items) }
})
onScopeDispose(request.dispose)
const { data, error, status, refresh, clear } = useAsyncData(key, request.fetch, { lazy: true, deep: false })
// A reactive key handles tenant changes. Keep filters in a scoped watcher rather than
// Nuxt's retained options, which would otherwise capture the component through query.
watch([query, scopeKey], ([_query, scope], [_previousQuery, previousScope]) => {
  if (scope === previousScope) void refresh()
})

// Keep the current grid during refresh; Nuxt owns cancellation and rejects stale completions.
watch(
  [data, status],
  ([response, currentStatus]) => {
    if (!response || currentStatus !== 'success') return
    total.value = response.total
    // Offset pages shift when an image is added meanwhile, so an appended page can repeat a row.
    const known = new Set(loaded.value.map(({ id }) => id))
    loaded.value =
      response.page > 1 ? [...loaded.value, ...response.items.filter(({ id }) => !known.has(id))] : response.items
  },
  { immediate: true },
)
const items = computed(() => loaded.value)
const hasMore = computed(() => items.value.length < total.value)
const loading = computed(() => status.value === 'idle' || status.value === 'pending')
const loadError = computed(() => !!error.value)
const reload = () => {
  // A mutation must fetch fresh data even while the surrounding app is still hydrating.
  reloadPages = page.value
  clear()
  return refresh()
}
defineExpose({ reload })

// The first render uses UTC and absolute dates, which the server and the browser agree on.
const mounted = useMounted()
const groups = computed(() =>
  groupByDay(items.value, {
    locale: locale.value,
    timeZone: mounted.value ? undefined : 'UTC',
    relativeTo: mounted.value ? new Date() : undefined,
  }),
)

const loadMore = () => {
  if (error.value) return refresh()
  if (hasMore.value && status.value === 'success') page.value++
}
// Only after a success: a failed page keeps the sentinel visible and must not retry in a loop.
const sentinelVisible = useElementVisibility(useTemplateRef<HTMLElement>('sentinel'))
watch([sentinelVisible, status], ([visible, current]) => {
  if (visible && current === 'success') loadMore()
})

const activate = (asset: MediaLibraryAsset) => (selectable ? emit('select', asset) : emit('inspect', asset.id))
</script>
