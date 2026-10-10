<template>
  <section class="space-y-3" :aria-labelledby="headingId">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 :id="headingId" class="text-sm font-semibold text-highlighted">{{ $t('widgets.placement.title') }}</h3>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="mdi:arrow-expand-all"
        :label="$t('widgets.placement.expand')"
        @click="expanded = true"
      />
    </div>
    <div class="overflow-hidden rounded-xl border border-default bg-default">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-2">
        <UTabs v-model="page" :items="pageItems" :content="false" size="xs" :ui="{ list: 'p-0.5' }" />
        <UTabs v-model="device" :items="deviceItems" :content="false" size="xs" :ui="{ list: 'p-0.5' }" />
      </div>
      <FormClientWidgetPagePreview
        v-if="source && !expanded"
        :source
        :state="previewState"
        :mobile="device === 'mobile'"
        @select="selectSlot"
      />
      <p v-else-if="!source" class="grid min-h-80 place-items-center px-6 text-center text-sm text-muted">
        {{ $t(articlePending ? 'widgets.placement.loading' : 'widgets.placement.noArticle') }}
      </p>
      <div v-else class="h-80 sm:h-96" />
      <div v-if="interactive" class="flex flex-wrap gap-1 border-t border-default p-2">
        <UButton
          v-for="slot in visibleSlots"
          :key="slot"
          size="xs"
          :color="modelValue === slot ? 'primary' : 'neutral'"
          :variant="modelValue === slot ? 'soft' : 'ghost'"
          :aria-pressed="modelValue === slot"
          :aria-label="$t('widgets.placement.choose', { slot: $t(`widgets.slots.${slot}`) })"
          :disabled="!canPreviewWidgetSlot(slot, kind)"
          @click="selectSlot(slot)"
        >
          {{ $t(`widgets.slots.${slot}`) }}
        </UButton>
      </div>
    </div>
    <p class="text-xs leading-relaxed text-muted">{{ $t(`widgets.placement.hints.${modelValue}`, modelValue) }}</p>
    <p class="text-xs text-muted">{{ $t('widgets.placement.realPage') }}</p>

    <UModal
      v-model:open="expanded"
      :title="$t('widgets.placement.title')"
      :description="$t(`widgets.placement.hints.${modelValue}`, modelValue)"
      fullscreen
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #body>
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default p-3">
          <UTabs v-model="page" :items="pageItems" :content="false" size="sm" />
          <UTabs v-model="device" :items="deviceItems" :content="false" size="sm" />
        </div>
        <FormClientWidgetPagePreview
          v-if="source && expanded"
          :source
          :state="previewState"
          :mobile="device === 'mobile'"
          expanded
          @select="selectSlot"
        />
        <p v-else class="p-6 text-sm text-muted">{{ $t('widgets.placement.noArticle') }}</p>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { WIDGET_SLOTS, type WidgetInput, type WidgetKind, type WidgetSlot } from '~~/shared/utils/widgets'

import { canPreviewWidgetSlot, widgetPagePreviewDraft, type WidgetPagePreviewState } from '~/utils/widgetPagePreview'

const modelValue = defineModel<string>({ required: true })
const {
  kind,
  widget,
  site,
  interactive = true,
} = defineProps<{
  kind?: WidgetKind
  widget?: WidgetInput
  site?: { name?: string | null; domain?: string | null } | null
  interactive?: boolean
}>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const headingId = useId()
const page = shallowRef('home')
const device = shallowRef('desktop')
const expanded = shallowRef(false)
watch(
  () => modelValue.value,
  (slot) => {
    page.value = slot === 'ARTICLE_END' ? 'article' : 'home'
  },
  { immediate: true },
)
const pageItems = computed(() => [
  { value: 'home', label: t('widgets.placement.pages.home') },
  { value: 'article', label: t('widgets.placement.pages.article') },
])
const deviceItems = computed(() => [
  { value: 'desktop', label: t('widgets.placement.desktop'), icon: 'mdi:monitor' },
  { value: 'mobile', label: t('widgets.placement.mobile'), icon: 'mdi:cellphone' },
])
const { data: articles, pending: articlePending } = await useLazyFetch(() => `/api/articles/featured/${site?.name}`, {
  query: { locale },
  immediate: Boolean(site?.name),
})
const article = computed(() => articles.value?.featured)
const previewQuery = computed(() => ({
  widgetPreview: '1',
  ...(site?.domain ? { widgetPreviewSite: site.domain } : {}),
}))
const source = computed(() => {
  if (page.value === 'home') return localePath({ name: 'index', query: previewQuery.value })
  if (!article.value?.slug) return null
  return localePath(
    { name: 'clanky-slug', params: { slug: article.value.slug }, query: previewQuery.value },
    article.value.language,
  )
})
const visibleSlots = computed(() =>
  (Object.keys(WIDGET_SLOTS) as WidgetSlot[]).filter((slot) =>
    page.value === 'home' ? slot !== 'ARTICLE_END' : ['BAR', 'ARTICLE_END', 'FOOTER'].includes(slot),
  ),
)
const previewState = computed<WidgetPagePreviewState>(() => ({
  slot: (modelValue.value in WIDGET_SLOTS ? modelValue.value : 'HOME_TOP') as WidgetSlot,
  kind: kind ?? null,
  widget: widgetPagePreviewDraft(widget),
  editingId: widget?.id ?? null,
  interactive,
}))
function selectSlot(slot: string) {
  if (interactive && slot in WIDGET_SLOTS && canPreviewWidgetSlot(slot as WidgetSlot, kind)) modelValue.value = slot
}
</script>
