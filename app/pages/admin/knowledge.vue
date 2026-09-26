<template>
  <div class="mx-auto flex min-h-0 w-full max-w-screen-lg flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">{{ $t('knowledge.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ $t('knowledge.description') }}</p>
        <p v-if="limits" class="mt-1 text-xs text-muted">
          {{
            $t('knowledge.quota', {
              sources: limits.usage.sources,
              maxSources: limits.maxSources,
              characters: formatCount(limits.usage.characters),
              maxCharacters: formatCount(limits.maxCharacters),
            })
          }}
        </p>
      </div>
      <UButton icon="mdi:plus" class="shrink-0" :disabled="quotaFull" @click="addOpen = true">
        {{ $t('knowledge.add') }}
      </UButton>
    </header>

    <KnowledgePlayground v-if="indexedCount" />

    <div v-if="status === 'pending' && !data" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton v-for="index in 3" :key="index" class="h-20 w-full" />
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="mdi:alert-circle-outline"
      :title="$t('knowledge.loadError')"
    />
    <UEmpty
      v-else-if="!sources.length"
      icon="mdi:book-open-page-variant-outline"
      :title="$t('knowledge.empty')"
      :description="$t('knowledge.emptyDescription')"
      :actions="[{ label: $t('knowledge.add'), icon: 'mdi:plus', onClick: () => (addOpen = true) }]"
    />
    <ul v-else class="flex flex-col gap-3" :aria-label="$t('knowledge.title')">
      <li
        v-for="source in sources"
        :key="source.id"
        class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4 sm:flex-row sm:items-center"
      >
        <UIcon :name="KIND_ICONS[source.kind]" class="size-6 shrink-0 text-muted" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              variant="link"
              color="neutral"
              :ui="{ base: 'p-0 font-medium text-highlighted', label: 'truncate' }"
              :label="source.title"
              @click="openEdit(source.id)"
            />
            <UBadge :color="STATUS_COLORS[source.status]" variant="subtle" size="sm">
              {{ $t(`knowledge.status.${source.status}`) }}
            </UBadge>
            <UBadge v-if="source.publicUrl" color="info" variant="outline" size="sm" icon="mdi:earth">
              {{ $t('knowledge.public') }}
            </UBadge>
            <UBadge v-if="isStale(source)" color="warning" variant="outline" size="sm" icon="mdi:clock-alert-outline">
              {{ $t('knowledge.stale') }}
            </UBadge>
          </div>
          <p class="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
            <span>{{ $t(`knowledge.kinds.${source.kind}`) }}</span>
            <template v-if="knowledgeAsOf(source)">
              <span aria-hidden="true">·</span>
              <span>{{ $t('knowledge.asOf') }} <AppTime :datetime="knowledgeAsOf(source)!" preset="date" /></span>
            </template>
            <template v-if="source.status === 'INDEXED'">
              <span aria-hidden="true">·</span>
              <span>{{ $t('knowledge.chunks', source.chunkCount) }}</span>
            </template>
            <span aria-hidden="true">·</span>
            <span v-if="source.lastUsedAt">
              {{ $t('knowledge.usage', source.usageCount) }}
              <AppTime :datetime="source.lastUsedAt" preset="relative" />
            </span>
            <span v-else>{{ $t('knowledge.unused') }}</span>
          </p>
          <p v-if="source.status === 'FAILED'" class="mt-1 text-xs text-error">{{ $t('knowledge.failed') }}</p>
          <p v-else-if="source.error" class="mt-1 text-xs text-warning">{{ $t('knowledge.refreshFailed') }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <USwitch
            :modelValue="source.useInArticles"
            :label="$t('knowledge.useInArticles')"
            :aria-label="$t('knowledge.useInArticlesFor', { title: source.title })"
            @update:modelValue="toggleUse(source.id, $event)"
          />
          <UDropdownMenu :items="actions(source)">
            <UButton
              icon="mdi:dots-vertical"
              color="neutral"
              variant="ghost"
              :aria-label="$t('knowledge.actions', { title: source.title })"
            />
          </UDropdownMenu>
        </div>
      </li>
    </ul>

    <KnowledgeAddSource v-model:open="addOpen" @created="refresh" />
    <KnowledgeEditSource :id="editId" v-model:open="editOpen" @saved="refresh" />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

import { isKnowledgeStale, knowledgeAsOf } from '~~/shared/utils/knowledge'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('knowledge.title') })

const KIND_ICONS = { NOTE: 'mdi:note-text-outline', FILE: 'mdi:file-document-outline', URL: 'mdi:link-variant' } as const
const STATUS_COLORS = { PENDING: 'neutral', PROCESSING: 'warning', INDEXED: 'success', FAILED: 'error' } as const

const { t, locale } = useI18n()
const toast = useAppToast()
const confirm = useConfirm()
const { data, status, error, refresh } = await useLazyFetch('/api/knowledge')
const sources = computed(() => data.value?.sources ?? [])
const limits = computed(() => data.value?.limits)
const quotaFull = computed(() => !!limits.value && limits.value.usage.sources >= limits.value.maxSources)
const indexedCount = computed(() => sources.value.filter((source) => source.status === 'INDEXED').length)
const addOpen = shallowRef(false)
const editOpen = shallowRef(false)
const editId = shallowRef<string | null>(null)
const formatCount = (value: number) =>
  new Intl.NumberFormat(locale.value, { notation: 'compact', maximumFractionDigits: 1 }).format(value)

type Source = (typeof sources.value)[number]

const isStale = (source: Source) => isKnowledgeStale(knowledgeAsOf(source))
const openEdit = (id: string) => {
  editId.value = id
  editOpen.value = true
}
// The editor links a used source here as `?source=<id>`; the detail endpoint scopes it to the tenant.
const linkedSource = useRoute().query.source
if (typeof linkedSource === 'string') openEdit(linkedSource)

// Indexing runs server-side; poll only while something is still in flight.
const indexing = computed(() => sources.value.some((source) => ['PENDING', 'PROCESSING'].includes(source.status)))
const { pause, resume } = useIntervalFn(refresh, 3000, { immediate: false })
watch(indexing, (active) => (active ? resume() : pause()), { immediate: true })

const run = async (request: () => Promise<unknown>, success?: string) => {
  try {
    await request()
    if (success) toast.success({ message: success })
  } catch (cause: any) {
    toast.error({ message: cause?.data?.message || t('knowledge.actionError') })
  } finally {
    await refresh()
  }
}

const toggleUse = (id: string, useInArticles: boolean) =>
  run(() => $fetch<unknown>(`/api/knowledge/${id}`, { method: 'PATCH', body: { useInArticles } }))

const remove = async (source: Source) => {
  if (!(await confirm({ title: t('knowledge.deleteTitle'), message: t('knowledge.deleteDescription'), variant: 'danger' })))
    return
  await run(() => $fetch<unknown>(`/api/knowledge/${source.id}`, { method: 'DELETE' }), t('knowledge.deleted'))
}

const actions = (source: Source): DropdownMenuItem[][] => [
  [
    {
      label: t('knowledge.edit'),
      icon: 'mdi:pencil-outline',
      onSelect: () => openEdit(source.id),
    },
    ...(source.kind === 'URL' || source.status === 'FAILED'
      ? [
          {
            label: t(source.kind === 'URL' ? 'knowledge.refresh' : 'knowledge.retry'),
            icon: 'mdi:refresh',
            disabled: source.status === 'PROCESSING',
            onSelect: () => run(() => $fetch<unknown>(`/api/knowledge/${source.id}/refresh`, { method: 'POST' })),
          },
        ]
      : []),
    ...(source.publicUrl
      ? [{ label: t('knowledge.openPublic'), icon: 'mdi:open-in-new', to: source.publicUrl, target: '_blank' }]
      : []),
  ],
  [{ label: t('knowledge.delete'), icon: 'mdi:delete-outline', color: 'error' as const, onSelect: () => remove(source) }],
]
</script>
