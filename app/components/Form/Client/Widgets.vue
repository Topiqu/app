<template>
  <section class="space-y-5" data-widgets>
    <header class="space-y-1">
      <h3 class="text-base font-semibold text-highlighted">{{ $t('widgets.title') }}</h3>
      <p class="text-sm text-muted">{{ $t('widgets.description') }}</p>
    </header>

    <UProgress v-if="isPending" :aria-label="$t('common.loading')" />
    <template v-else>
      <p v-if="!items.length" class="text-sm text-muted">{{ $t('widgets.empty') }}</p>

      <article
        v-for="(item, index) in items"
        :key="item.key"
        class="overflow-hidden rounded-lg border border-default"
        :aria-label="$t('widgets.item', { n: index + 1, kind: $t(`widgets.kinds.${item.kind}`) })"
      >
        <header class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
          <UIcon :name="WIDGET_ICONS[item.kind]" class="size-5 text-muted" aria-hidden="true" />
          <span class="font-medium text-highlighted">{{ $t(`widgets.kinds.${item.kind}`) }}</span>
          <UBadge v-if="!allowed.includes(item.kind)" color="warning" variant="soft">
            {{ $t('widgets.hidden') }}
          </UBadge>
          <div class="ms-auto flex flex-wrap items-center gap-1">
            <USelect
              v-if="item.kind !== 'ANNOUNCEMENT'"
              v-model="item.slot"
              :items="slotItems(item.kind)"
              size="sm"
              class="w-44"
              :aria-label="$t('widgets.slot')"
            />
            <UButton
              icon="mdi:arrow-up"
              size="sm"
              color="neutral"
              variant="ghost"
              :disabled="index === 0"
              :aria-label="$t('widgets.moveUp')"
              @click="move(index, -1)"
            />
            <UButton
              icon="mdi:arrow-down"
              size="sm"
              color="neutral"
              variant="ghost"
              :disabled="index === items.length - 1"
              :aria-label="$t('widgets.moveDown')"
              @click="move(index, 1)"
            />
            <USwitch v-model="item.active" :aria-label="$t('widgets.active')" class="mx-1" />
            <UButton
              icon="mdi:trash-can-outline"
              size="sm"
              color="error"
              variant="ghost"
              :aria-label="$t('common.actions.delete')"
              @click="items.splice(index, 1)"
            />
          </div>
        </header>

        <WidgetBar v-if="item.kind === 'ANNOUNCEMENT'" :announcement="barPreview(item)" preview />
        <div class="space-y-4 p-4">
          <FormClientWidgetAnnouncement v-if="item.kind === 'ANNOUNCEMENT'" v-model:config="item.config" />
          <FormClientWidgetDivider v-else-if="item.kind === 'DIVIDER'" v-model:config="item.config" />
          <FormClientWidgetCta v-else-if="item.kind === 'CTA'" v-model:config="item.config" />
          <FormClientWidgetPrice v-else-if="item.kind === 'PRICE'" v-model:config="item.config" />
          <FormClientWidgetWeather v-else-if="item.kind === 'WEATHER'" v-model:config="item.config" />
          <FormClientWidgetHtml v-else-if="item.kind === 'HTML'" v-model:config="item.config" />

          <UFormField :label="$t('widgets.languages')" :hint="$t('widgets.languagesHint')">
            <UCheckboxGroup v-model="item.languages" :items="languageItems" orientation="horizontal" />
          </UFormField>

          <div v-if="item.kind === 'DIVIDER' || item.kind === 'CTA'" class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">{{ $t('widgets.preview') }}</p>
            <div class="rounded-lg border border-dashed border-default p-4">
              <WidgetDivider v-if="item.kind === 'DIVIDER'" :config="item.config" />
              <WidgetCta v-else-if="item.kind === 'CTA'" :config="ctaPreview(item.config)" />
            </div>
          </div>
        </div>
      </article>

      <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>

      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="mdi:plus"
          :disabled="items.length >= MAX_WIDGETS"
          @click="galleryOpen = true"
        >
          {{ $t('widgets.add') }}
        </UButton>
        <UButton icon="mdi:content-save-outline" :loading="saving" :disabled="!dirty" @click="save">
          {{ $t('common.actions.save') }}
        </UButton>
      </div>

      <FormClientWidgetGallery v-model:open="galleryOpen" :allowed @pick="add" />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { z } from 'zod'
import type { Language } from '~~/shared/utils/language'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import {
  MAX_WIDGETS,
  WIDGET_SLOTS,
  widgetsInputSchema,
  type CtaConfig,
  type WidgetKind,
  type WidgetSlot,
} from '~~/shared/utils/widgets'

import { WIDGET_ICONS, WIDGET_PRESETS, type WidgetDraft } from '~/utils/widgetPresets'

type StoredWidget = { id: string; kind: WidgetKind; slot: string; active: boolean; languages: Language[]; config: unknown }

const { t } = useI18n()
const toast = useToast()
const site = await useLiveClientSite()

const { data, isPending, refetch } = useQuery({
  key: () => queryKeys.widgets.all,
  query: () => $fetch<{ widgets: StoredWidget[]; allowed: WidgetKind[] }>('/api/widgets'),
})
const allowed = computed(() => data.value?.allowed ?? [])

const languageItems = computed(() => LANGUAGE_OPTIONS.map((value) => ({ value, label: t(`languages.${value}`) })))
const slotItems = (kind: WidgetKind) =>
  (Object.keys(WIDGET_SLOTS) as WidgetSlot[])
    .filter((slot) => (WIDGET_SLOTS[slot] as readonly WidgetKind[]).includes(kind))
    .map((value): { value: string; label: string } => ({ value, label: t(`widgets.slots.${value}`) }))

const items = ref<WidgetDraft[]>([])
const pristine = shallowRef('[]')
const dirty = computed(() => JSON.stringify(items.value) !== pristine.value)
const error = shallowRef('')
const saving = shallowRef(false)
const galleryOpen = shallowRef(false)

watch(
  () => data.value?.widgets,
  (widgets) => {
    items.value = (widgets ?? []).map((widget) => ({ ...widget, key: widget.id }) as WidgetDraft)
    pristine.value = JSON.stringify(items.value)
  },
  { immediate: true },
)

let created = 0
function add(presetId: string) {
  const preset = WIDGET_PRESETS.find((p) => p.id === presetId)
  if (!preset) return
  const config = preset.config({ t, currency: site.value?.currency ?? 'EUR' })
  items.value.push({
    key: `new-${created++}`,
    kind: preset.kind,
    slot: preset.slot,
    active: true,
    languages: [],
    config,
  } as WidgetDraft)
}

function move(index: number, by: -1 | 1) {
  const [item] = items.value.splice(index, 1)
  items.value.splice(index + by, 0, item!)
}

const barPreview = (item: Extract<WidgetDraft, { kind: 'ANNOUNCEMENT' }>) => ({
  ...item.config,
  id: item.key,
  text: item.config.text || t('widgets.announcement.placeholder'),
  link: item.config.link?.url && item.config.link.label ? item.config.link : null,
})
const ctaPreview = (config: CtaConfig): CtaConfig => ({
  ...config,
  title: config.title || t('widgets.cta.title'),
  button: { url: config.button.url || '/', label: config.button.label || t('widgets.cta.button') },
})

// Empty optional parts are dropped here, so the schema sees `null` rather than a half-filled object.
const toInput = ({ key: _key, ...draft }: WidgetDraft) => {
  if (draft.kind === 'ANNOUNCEMENT' && !draft.config.link?.url.trim())
    return { ...draft, config: { ...draft.config, link: null } }
  return draft
}

const issueMessage = (issue: z.core.$ZodIssue) => {
  const n = Number(issue.path[1]) + 1
  if (['ANNOUNCEMENT_OVERLAP', 'SLOT_FULL', 'SLOT_KIND'].includes(issue.message))
    return t(`widgets.errors.${issue.message}`, { n })
  const field = issue.path.findLast((part) => typeof part === 'string' && part !== 'config')
  return t(`widgets.errors.field`, { n, field: t(`widgets.fields.${String(field)}`, String(field)) })
}

async function save() {
  const parsed = widgetsInputSchema.safeParse({ widgets: items.value.map(toInput) })
  if (!parsed.success) {
    error.value = issueMessage(parsed.error.issues[0]!)
    return
  }
  error.value = ''
  saving.value = true
  try {
    await $fetch('/api/widgets', { method: 'PUT', body: parsed.data })
    await Promise.all([refetch(), refreshClientSite()])
    toast.add({ color: 'success', title: t('common.messages.successGeneralTitle') })
  } catch (err) {
    toast.add({ color: 'error', title: fetchErrorMessage(err, t('common.messages.operationFailed')) })
  } finally {
    saving.value = false
  }
}
</script>
