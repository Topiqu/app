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
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <div v-for="index in 15" :key="index" class="overflow-hidden rounded-(--topiqu-surface-radius)">
        <USkeleton class="aspect-square w-full" />
      </div>
    </div>

    <UEmpty
      v-else-if="!items.length"
      icon="mdi:image-off-outline"
      :title="$t('media.empty')"
      :description="$t('media.emptyDescription')"
    />

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <article
        v-for="asset in items"
        :key="asset.id"
        class="group relative cursor-pointer overflow-hidden rounded-(--topiqu-surface-radius) border bg-default transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="
          selectedId === asset.id ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-primary/50'
        "
        role="button"
        tabindex="0"
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
          sizes="xs:50vw phone:50vw sm:33vw lg:25vw xl:220px"
          containerClass="w-full"
        />
        <div class="space-y-1 p-3">
          <p class="truncate text-sm font-medium text-highlighted">
            {{ asset.name || asset.originalFilename || asset.id }}
          </p>
          <div class="flex items-center justify-between gap-2 text-xs text-muted">
            <span class="truncate">{{ $t(`media.origins.${asset.origin}`) }}</span>
            <span class="shrink-0">{{ asset.usageCount }}</span>
          </div>
        </div>
        <UButton
          class="absolute right-2 top-2 z-10"
          color="neutral"
          variant="soft"
          size="xs"
          square
          icon="mdi:information-outline"
          :aria-label="$t('media.details')"
          @click.stop="$emit('inspect', asset.id)"
        />
      </article>
    </div>

    <div v-if="total > pageSize" class="flex flex-col items-center justify-center gap-3 border-t border-default pt-4">
      <UPagination v-model:page="page" :total="total" :itemsPerPage="pageSize" />
      <p class="text-xs text-muted">
        {{ $t('media.pagination', { from: rangeStart, to: rangeEnd, total }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MediaLibraryAsset, MediaLibraryPage } from '~~/shared/types/mediaLibrary'

import { MEDIA_ORIGINS } from '~~/shared/types/mediaRights'

import { createAsyncDataRequest } from '~/utils/asyncDataRequest'

const { selectable = false, selectedId = null } = defineProps<{ selectable?: boolean; selectedId?: string | null }>()
const emit = defineEmits<{ select: [asset: MediaLibraryAsset]; inspect: [id: string] }>()
const { t } = useI18n()
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
const lastPage = shallowRef<MediaLibraryPage>()

watch([debouncedSearch, origin, usage, archived], () => (page.value = 1), { flush: 'sync' })
watch(
  scopeKey,
  () => {
    lastPage.value = undefined
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
const request = createAsyncDataRequest((signal) =>
  requestFetch<MediaLibraryPage>('/api/media', { query: query.value, signal }),
)
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
    if (response && currentStatus === 'success') lastPage.value = response
  },
  { immediate: true },
)
const items = computed(() => lastPage.value?.items ?? [])
const total = computed(() => lastPage.value?.total ?? 0)
const loading = computed(() => status.value === 'idle' || status.value === 'pending')
const loadError = computed(() => !!error.value)
const reload = () => {
  // A mutation must fetch fresh data even while the surrounding app is still hydrating.
  clear()
  return refresh()
}
defineExpose({ reload })

const rangeStart = computed(() => (total.value ? (page.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize, total.value))
const activate = (asset: MediaLibraryAsset) => (selectable ? emit('select', asset) : emit('inspect', asset.id))
</script>
