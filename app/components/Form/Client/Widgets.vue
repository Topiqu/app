<template>
  <section class="@container space-y-6" data-widgets>
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 space-y-1">
        <h3 class="text-base font-semibold text-highlighted">{{ $t('widgets.title') }}</h3>
        <p class="max-w-prose text-sm text-muted">{{ $t('widgets.description') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="mdi:view-grid-plus-outline"
          :disabled="isPending || items.length >= MAX_WIDGETS"
          @click="libraryOpen = true"
        >
          {{ $t('widgets.add') }}
        </UButton>
        <UButton icon="mdi:content-save-outline" :loading="saving" :disabled="!dirty" @click="save">
          {{ $t('common.actions.save') }}
        </UButton>
      </div>
    </header>

    <UProgress v-if="isPending" :aria-label="$t('common.loading')" />
    <template v-else>
      <p v-if="error && !invalidKey" class="text-sm text-error" role="alert">{{ error }}</p>

      <div
        v-if="!items.length"
        class="flex flex-col items-center gap-3 rounded-(--topiqu-surface-radius) border border-dashed border-accented px-6 py-12 text-center"
      >
        <UIcon name="mdi:widgets-outline" class="size-10 text-dimmed" aria-hidden="true" />
        <p class="font-medium text-highlighted">{{ $t('widgets.empty') }}</p>
        <p class="max-w-sm text-sm text-muted">{{ $t('widgets.emptyHint') }}</p>
        <UButton icon="mdi:view-grid-plus-outline" class="mt-2" @click="libraryOpen = true">
          {{ $t('widgets.add') }}
        </UButton>
      </div>

      <section
        v-for="group in groups"
        :key="group.slot"
        class="space-y-3"
        :aria-labelledby="`widget-slot-${group.slot}`"
      >
        <header class="flex items-center gap-2">
          <h4 :id="`widget-slot-${group.slot}`" class="text-sm font-semibold text-highlighted">
            {{ slotLabel(group.slot) }}
          </h4>
          <UBadge
            v-if="group.slot !== 'BAR'"
            :color="group.active > MAX_PER_SLOT ? 'error' : 'neutral'"
            variant="soft"
            size="sm"
          >
            {{ $t('widgets.slotUsage', { active: group.active, max: MAX_PER_SLOT }) }}
          </UBadge>
          <UPopover :content="{ align: 'end' }" class="ms-auto">
            <UButton color="neutral" variant="ghost" size="xs" icon="mdi:map-marker-outline">{{
              $t('widgets.placement.show')
            }}</UButton>
            <template #content>
              <div class="w-[min(24rem,calc(100vw-2rem))] p-4">
                <FormClientWidgetPlacement :modelValue="group.slot" :site="previewSite" :interactive="false" />
              </div>
            </template>
          </UPopover>
        </header>

        <ul class="grid gap-4 @lg:grid-cols-2 @4xl:grid-cols-3">
          <li v-for="({ item, index }, at) in group.entries" :key="item.key">
            <article
              :data-widget-key="item.key"
              class="relative flex h-full flex-col overflow-hidden rounded-(--topiqu-surface-radius) border bg-default transition"
              :class="
                item.key === invalidKey
                  ? 'border-error ring-1 ring-error'
                  : 'border-default hover:border-accented hover:shadow-md'
              "
              :aria-label="$t('widgets.item', { n: at + 1, kind: $t(`widgets.kinds.${item.kind}`) })"
            >
              <div class="relative">
                <FormClientWidgetThumb :class="{ 'opacity-50 grayscale': !item.active }">
                  <FormClientWidgetPreview :widget="item" />
                </FormClientWidgetThumb>
                <!-- Covers the preview: it holds headings and links, which a button may not contain. -->
                <button
                  type="button"
                  class="absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  :aria-label="$t('widgets.edit', { name: cardTitle(item) })"
                  @click="editingKey = item.key"
                />
              </div>
              <div class="flex flex-1 flex-col gap-3 border-t border-default p-3">
                <div class="flex min-w-0 items-start gap-2">
                  <UIcon :name="WIDGET_ICONS[item.kind]" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-highlighted" :title="cardTitle(item)">
                      {{ cardTitle(item) }}
                    </p>
                    <p class="truncate text-xs text-muted">
                      {{ $t(`widgets.kinds.${item.kind}`) }} · {{ languageSummary(item) }}
                    </p>
                  </div>
                  <UBadge v-if="!allowed.includes(item.kind)" color="warning" variant="soft" size="sm" class="shrink-0">
                    {{ $t('widgets.hidden') }}
                  </UBadge>
                </div>
                <div class="mt-auto flex items-center gap-1">
                  <USwitch v-model="item.active" size="sm" :aria-label="$t('widgets.active')" class="me-1" />
                  <UButton
                    icon="mdi:chevron-left"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :disabled="at === 0"
                    :aria-label="$t('widgets.moveEarlier')"
                    @click="move(group.entries, at, -1)"
                  />
                  <UButton
                    icon="mdi:chevron-right"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :disabled="at === group.entries.length - 1"
                    :aria-label="$t('widgets.moveLater')"
                    @click="move(group.entries, at, 1)"
                  />
                  <UButton
                    icon="mdi:pencil-outline"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    class="ms-auto"
                    :aria-label="$t('widgets.edit', { name: cardTitle(item) })"
                    @click="editingKey = item.key"
                  />
                  <UButton
                    icon="mdi:trash-can-outline"
                    size="xs"
                    color="error"
                    variant="ghost"
                    :aria-label="$t('common.actions.delete')"
                    @click="remove(index)"
                  />
                </div>
              </div>
            </article>
          </li>
        </ul>
      </section>

      <FormClientWidgetLibrary v-model:open="libraryOpen" :allowed :currency @pick="add" />

      <USlideover
        v-model:open="editorOpen"
        :title="editing ? $t(`widgets.kinds.${editing.item.kind}`) : ''"
        :description="editing ? slotLabel(editing.item.slot) : ''"
        :ui="{ content: 'max-w-xl', body: 'p-0 sm:p-0' }"
      >
        <template #body>
          <div v-if="editing" :key="editing.item.key">
            <div class="border-b border-default bg-muted">
              <FormClientWidgetPreview v-if="editing.item.kind === 'ANNOUNCEMENT'" :widget="editing.item" />
              <div v-else class="space-y-3 p-4 sm:p-6">
                <FormClientWidgetPreview :widget="editing.item" />
                <div v-if="editing.item.kind === 'HTML'" class="flex flex-wrap items-center gap-3">
                  <UButton
                    v-if="savedFrameUrl(editing.item)"
                    :to="savedFrameUrl(editing.item)"
                    target="_blank"
                    external
                    color="neutral"
                    variant="soft"
                    size="sm"
                    icon="mdi:open-in-new"
                  >
                    {{ $t('widgets.html.openSaved') }}
                  </UButton>
                  <p class="text-xs text-muted">
                    {{ $t(savedFrameUrl(editing.item) ? 'widgets.html.openSavedHint' : 'widgets.html.saveToPreview') }}
                  </p>
                </div>
              </div>
            </div>

            <div class="space-y-5 p-4 sm:p-6">
              <p
                v-if="editing.item.key === invalidKey"
                class="rounded-md bg-error/10 px-3 py-2 text-sm text-error"
                role="alert"
              >
                {{ error }}
              </p>

              <UFormField v-if="editing.item.kind !== 'ANNOUNCEMENT'" :label="$t('widgets.slot')">
                <USelect
                  :modelValue="editing.item.slot"
                  :items="slotItems(editing.item.kind)"
                  class="w-full"
                  @update:modelValue="setSlot(editing.index, $event)"
                />
              </UFormField>

              <UCollapsible :defaultOpen="true">
                <UButton
                  color="neutral"
                  variant="soft"
                  block
                  icon="mdi:map-marker-outline"
                  trailingIcon="mdi:chevron-down"
                  :label="$t('widgets.placement.title')"
                />
                <template #content>
                  <FormClientWidgetPlacement
                    class="mt-3"
                    :modelValue="editing.item.slot"
                    :kind="editing.item.kind"
                    :widget="editing.item"
                    :site="previewSite"
                    @update:modelValue="setSlot(editing.index, $event)"
                  />
                </template>
              </UCollapsible>

              <FormClientWidgetAnnouncement
                v-if="editing.item.kind === 'ANNOUNCEMENT'"
                v-model:config="editing.item.config"
              />
              <FormClientWidgetDivider
                v-else-if="editing.item.kind === 'DIVIDER'"
                v-model:config="editing.item.config"
              />
              <FormClientWidgetCta v-else-if="editing.item.kind === 'CTA'" v-model:config="editing.item.config" />
              <FormClientWidgetPrice v-else-if="editing.item.kind === 'PRICE'" v-model:config="editing.item.config" />
              <FormClientWidgetWeather
                v-else-if="editing.item.kind === 'WEATHER'"
                v-model:config="editing.item.config"
              />
              <FormClientWidgetHtml v-else-if="editing.item.kind === 'HTML'" v-model:config="editing.item.config" />

              <UFormField :label="$t('widgets.languages')" :hint="$t('widgets.languagesHint')">
                <UCheckboxGroup v-model="editing.item.languages" :items="languageItems" orientation="horizontal" />
              </UFormField>
            </div>
          </div>
        </template>
        <template #footer>
          <UButton
            v-if="editing"
            icon="mdi:trash-can-outline"
            color="error"
            variant="ghost"
            @click="remove(editing.index)"
          >
            {{ $t('common.actions.delete') }}
          </UButton>
          <div class="ms-auto flex gap-2">
            <UButton color="neutral" variant="soft" @click="editingKey = null">{{ $t('widgets.done') }}</UButton>
            <UButton icon="mdi:content-save-outline" :loading="saving" :disabled="!dirty" @click="save">
              {{ $t('common.actions.save') }}
            </UButton>
          </div>
        </template>
      </USlideover>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { z } from 'zod'
import type { Language } from '~~/shared/utils/language'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import {
  MAX_PER_SLOT,
  MAX_WIDGETS,
  WIDGET_SLOTS,
  resolveWidgetSlot,
  widgetsInputSchema,
  type WidgetKind,
  type WidgetSlot,
} from '~~/shared/utils/widgets'

import { WIDGET_ICONS, WIDGET_PRESETS, type WidgetDraft } from '~/utils/widgetPresets'

type StoredWidget = {
  id: string
  kind: WidgetKind
  slot: string
  active: boolean
  languages: Language[]
  config: unknown
}

const { t } = useI18n()
const toast = useToast()
const requestFetch = useRequestFetch()
const site = await useLiveClientSite()
const { data: ownedSite } = await useClientSiteStatus()
const previewSite = computed(() => ownedSite.value ?? site.value)

const { data, isPending, refetch } = useQuery({
  key: () => queryKeys.widgets.all,
  query: () => requestFetch<{ widgets: StoredWidget[]; allowed: WidgetKind[] }>('/api/widgets'),
})
const allowed = computed(() => data.value?.allowed ?? [])
const currency = computed(() => site.value?.currency ?? 'EUR')

const slotLabel = (slot: string) => t(`widgets.slots.${slot}`, slot)
const languageItems = computed(() => LANGUAGE_OPTIONS.map((value) => ({ value, label: t(`languages.${value}`) })))
const slotItems = (kind: WidgetKind) =>
  (Object.keys(WIDGET_SLOTS) as WidgetSlot[])
    .filter((slot) => (WIDGET_SLOTS[slot] as readonly WidgetKind[]).includes(kind))
    .map((value): { value: string; label: string } => ({ value, label: t(`widgets.slots.${value}`) }))

const items = ref<WidgetDraft[]>([])
const pristine = shallowRef('[]')
const dirty = computed(() => JSON.stringify(items.value) !== pristine.value)
const error = shallowRef('')
const invalidKey = shallowRef('')
const saving = shallowRef(false)
const libraryOpen = shallowRef(false)

const editingKey = shallowRef<string | null>(null)
const editing = computed(() => {
  const index = items.value.findIndex((item) => item.key === editingKey.value)
  return index === -1 ? null : { item: items.value[index]!, index }
})
const editorOpen = computed({
  get: () => !!editing.value,
  set: (open: boolean) => {
    if (!open) editingKey.value = null
  },
})

watch(
  () => data.value?.widgets,
  (widgets) => {
    items.value = (widgets ?? []).map(
      (widget) => ({ ...widget, slot: resolveWidgetSlot(widget.slot) ?? widget.slot, key: widget.id }) as WidgetDraft,
    )
    pristine.value = JSON.stringify(items.value)
  },
  { immediate: true },
)
watch(
  items,
  () => {
    error.value = ''
    invalidKey.value = ''
  },
  { deep: true },
)

// The array order is `position`. Grouped by slot, only the order within a slot shows, so moves swap
// neighbours of one slot. A slot the layout no longer has still gets a group, or its widgets would hide.
const groups = computed(() =>
  [...new Set([...Object.keys(WIDGET_SLOTS), ...items.value.map((item) => item.slot)])].flatMap((slot) => {
    const entries = items.value.flatMap((item, index) => (item.slot === slot ? [{ item, index }] : []))
    return entries.length ? [{ slot, entries, active: entries.filter(({ item }) => item.active).length }] : []
  }),
)

const configTitle = (item: WidgetDraft) => {
  switch (item.kind) {
    case 'ANNOUNCEMENT':
      return item.config.text
    case 'DIVIDER':
      return item.config.label || t(`widgets.divider.styles.${item.config.style}`)
    case 'PRICE':
      return `${item.config.assets.join(', ')} → ${item.config.quote}`
    case 'WEATHER':
      return item.config.place.name
    default:
      return item.config.title
  }
}
const cardTitle = (item: WidgetDraft) => configTitle(item) || t(`widgets.kinds.${item.kind}`)
const languageSummary = (item: WidgetDraft) =>
  item.languages.length ? item.languages.map((code) => code.toUpperCase()).join(', ') : t('widgets.allLanguages')

let created = 0
function add(presetId: string) {
  const preset = WIDGET_PRESETS.find((p) => p.id === presetId)
  if (!preset) return
  const key = `new-${created++}`
  items.value.push({
    key,
    kind: preset.kind,
    slot: preset.slot,
    active: true,
    languages: [],
    config: preset.config({ t, currency: currency.value }),
  } as WidgetDraft)
  editingKey.value = key
}

function remove(index: number) {
  const [item] = items.value.splice(index, 1)
  if (item?.key === editingKey.value) editingKey.value = null
}

function move(entries: { index: number }[], at: number, by: -1 | 1) {
  const from = entries[at]!.index
  const to = entries[at + by]!.index
  const item = items.value[from]!
  items.value[from] = items.value[to]!
  items.value[to] = item
}

// A widget moved to another slot lands at its end.
function setSlot(index: number, slot: string) {
  if (items.value[index]?.slot === slot) return
  const [item] = items.value.splice(index, 1)
  item!.slot = slot
  items.value.push(item!)
}

// The HTML frame is served only on the tenant's own domain, and only for a saved, active widget.
const savedFrameUrl = (item: WidgetDraft) =>
  item.id && item.active && allowed.value.includes('HTML') && site.value?.domain
    ? `https://${site.value.domain}/widgets/${item.id}`
    : undefined

// Empty optional parts are dropped here, so the schema sees `null` rather than a half-filled object.
const toInput = ({ key: _key, ...draft }: WidgetDraft) => {
  if (draft.kind === 'ANNOUNCEMENT' && !draft.config.link?.url.trim())
    return { ...draft, config: { ...draft.config, link: null } }
  return draft
}

const issueMessage = (issue: z.core.$ZodIssue, item: WidgetDraft | undefined) => {
  const widget = item ? `${t(`widgets.kinds.${item.kind}`)} · ${slotLabel(item.slot)}` : ''
  if (['ANNOUNCEMENT_OVERLAP', 'SLOT_FULL', 'SLOT_KIND'].includes(issue.message))
    return t(`widgets.errors.${issue.message}`, { widget })
  const field = issue.path.findLast((part) => typeof part === 'string' && part !== 'config')
  return t(`widgets.errors.field`, { widget, field: t(`widgets.fields.${String(field)}`, String(field)) })
}

async function save() {
  const parsed = widgetsInputSchema.safeParse({ widgets: items.value.map(toInput) })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!
    const item = items.value[Number(issue.path[1])]
    error.value = issueMessage(issue, item)
    invalidKey.value = item?.key ?? ''
    // The offending widget opens in the editor, where the error sits above its form.
    if (item) editingKey.value = item.key
    return
  }
  error.value = ''
  invalidKey.value = ''
  saving.value = true
  try {
    await $fetch('/api/widgets', { method: 'PUT', body: parsed.data })
    await Promise.all([refetch(), refreshClientSite()])
    editingKey.value = null
    toast.add({ color: 'success', title: t('common.messages.saveSuccess') })
  } catch (err) {
    toast.add({ color: 'error', title: fetchErrorMessage(err, t('common.messages.operationFailed')) })
  } finally {
    saving.value = false
  }
}
</script>
