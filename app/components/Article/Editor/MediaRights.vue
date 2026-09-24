<template>
  <section data-media-rights>
    <UCollapsible v-model:open="open">
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        type="button"
        class="w-full"
        :ui="{ trailingIcon: 'ms-auto' }"
        icon="mdi:copyright"
        :trailingIcon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :label="$t('articles.editor.mediaRights.title')"
      />
      <template #content>
        <div class="mt-3 rounded-lg border border-default bg-elevated/30 p-4" aria-live="polite">
          <p class="text-xs leading-5 text-muted">{{ $t('articles.editor.mediaRights.description') }}</p>
          <div v-if="state === 'loading' || state === 'analyzing'" class="mt-3"><UProgress /></div>
          <UAlert
            v-else-if="state === 'error'"
            class="mt-3"
            color="error"
            variant="soft"
            icon="mdi:alert-circle-outline"
            :title="$t('articles.editor.mediaRights.error')"
          />
          <template v-else-if="result">
            <div class="mt-3 flex flex-wrap gap-2">
              <UBadge color="success" variant="soft">{{
                $t('articles.editor.mediaRights.recordedCount', { count: result.counts.recorded })
              }}</UBadge>
              <UBadge v-if="result.counts.needsAttention" color="warning" variant="soft">{{
                $t('articles.editor.mediaRights.attentionCount', { count: result.counts.needsAttention })
              }}</UBadge>
            </div>
            <UAlert
              v-if="!result.items.length"
              class="mt-3"
              color="neutral"
              variant="soft"
              icon="mdi:image-off-outline"
              :description="$t('articles.editor.mediaRights.empty')"
            />
            <ul v-else class="mt-3 space-y-2">
              <li v-for="item in result.items" :key="item.key" class="rounded-md border border-default bg-default p-3">
                <div class="flex items-start gap-3">
                  <AppMedia :src="item.url" alt="" containerClass="size-14 shrink-0 rounded-md" aspectRatio="1 / 1" />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UBadge :color="item.state === 'recorded' ? 'success' : 'warning'" variant="soft" size="sm">
                        {{ $t(`articles.editor.mediaRights.state.${item.state}`) }}
                      </UBadge>
                      <span class="text-xs text-muted">{{ $t(`articles.editor.mediaRights.${item.placement}`) }}</span>
                    </div>
                    <p class="mt-1 truncate text-xs text-muted">{{ item.asset?.originalFilename || item.url }}</p>
                    <ul v-if="item.issues.length" class="mt-1 text-xs leading-5 text-warning">
                      <li v-for="issue in item.issues" :key="issue.code">
                        {{ $t(`articles.editor.mediaRights.issue.${issue.code}`) }}
                      </li>
                    </ul>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="mdi:arrow-right"
                      :aria-label="$t('articles.editor.optimization.goTo')"
                      @click="$emit('navigate', item)"
                    />
                    <UButton
                      color="primary"
                      variant="ghost"
                      size="xs"
                      icon="mdi:pencil-outline"
                      :aria-label="$t('common.actions.edit')"
                      @click="edit(item)"
                    />
                  </div>
                </div>
              </li>
            </ul>
            <p class="mt-3 text-[11px] leading-4 text-muted">{{ $t('articles.editor.mediaRights.disclaimer') }}</p>
          </template>
        </div>
      </template>
    </UCollapsible>

    <MediaDetail :id="active?.asset?.id" v-model:open="editorOpen" @updated="$emit('updated')" />
  </section>
</template>

<script setup lang="ts">
import type { MediaRightsItem, MediaRightsReport } from '~~/shared/types/mediaRights'

import type { MediaRightsState } from '~/composables/useMediaRights'

defineProps<{ state: MediaRightsState; result: MediaRightsReport | null }>()
const emit = defineEmits<{
  navigate: [item: MediaRightsItem]
  attach: [item: MediaRightsItem, mediaId: string]
  updated: []
}>()
const open = shallowRef(false)
const editorOpen = shallowRef(false)
const active = shallowRef<MediaRightsItem | null>(null)

const edit = async (item: MediaRightsItem) => {
  active.value = item
  let asset = item.asset
  if (!asset) {
    const response = await $fetch<{ asset: MediaRightsItem['asset'] }>('/api/media/external', {
      method: 'POST',
      body: { url: item.url },
    })
    asset = response.asset
    if (asset) {
      active.value = { ...item, asset }
      emit('attach', item, asset.id)
    }
  }
  if (!asset) return
  if (!item.mediaId) emit('attach', item, asset.id)
  editorOpen.value = true
}
</script>
