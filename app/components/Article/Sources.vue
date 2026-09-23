<template>
  <fieldset class="space-y-3">
    <legend class="mb-2 text-sm font-medium text-highlighted">{{ $t('articles.columns.sources') }}</legend>
    <ol class="space-y-3">
      <li
        v-for="(source, index) in sources"
        :key="index"
        :ref="(element) => setSourceRow(element, index)"
        class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2"
      >
        <span class="flex size-8 items-center justify-center text-sm font-bold tabular-nums text-muted">
          {{ index + 1 }}
        </span>
        <div class="min-w-0">
          <UFormField
            :label="`${$t('articles.columns.sources')} ${index + 1}`"
            :ui="{ label: 'sr-only' }"
            :error="source && !isValidURL(source) ? $t('articles.sources.invalid') : undefined"
          >
            <UInput
              v-model="sources[index]"
              type="url"
              :placeholder="$t('articles.sources.placeholder')"
              class="w-full"
              :color="source && !isValidURL(source) ? 'error' : 'primary'"
              :highlight="Boolean(source && !isValidURL(source))"
              @blur="sanitizeSource(index)"
              @keyup.enter="addSourceIfValid(index)"
            />
          </UFormField>
          <div v-if="source" class="mt-1.5 flex min-w-0 items-center gap-2 px-1">
            <AppMedia
              :src="sourceFaviconUrl(source)"
              :alt="extractDomain(source)"
              :fallbackText="extractDomain(source)"
              aspectRatio="1 / 1"
              fit="contain"
              sizes="20px"
              containerClass="size-5 shrink-0 rounded-[var(--ui-radius)]"
            />
            <span class="min-w-0 truncate text-xs text-muted">{{ extractDomain(source) }}</span>
          </div>
        </div>
        <UButton
          icon="mdi:delete"
          color="error"
          variant="ghost"
          square
          :aria-label="$t('common.actions.delete')"
          @click="removeSource(index)"
        />
      </li>
    </ol>
    <UButton icon="mdi:plus" color="neutral" variant="soft" size="sm" @click="addSource">
      {{ $t('articles.tags.addButton') }}
    </UButton>
  </fieldset>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

import { sourceFaviconUrl } from '~/utils/sourcePresentation'

const sources = defineModel<string[]>({ required: true })

defineProps<{ compact?: boolean }>()

const sourceRows = new Map<number, HTMLElement>()
const setSourceRow = (element: Element | ComponentPublicInstance | null, index: number) => {
  if (element instanceof HTMLElement) sourceRows.set(index, element)
  else sourceRows.delete(index)
}
const focusSource = (index?: number) => {
  const row = sourceRows.get(index ?? -1)
  row?.querySelector<HTMLInputElement>('input')?.focus()
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return row ?? null
}
defineExpose({ focusSource })

const extractDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const isValidURL = (str: string) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

const sanitizeSource = (index: number) => {
  let url = sources.value[index]?.trim()
  if (!url) return
  if (!url.startsWith('http')) url = 'https://' + url
  sources.value[index] = url
}

const addSource = () => {
  sources.value.push('')
}

const addSourceIfValid = (index: number) => {
  const last = sources.value[index]
  if (last && last.trim().length > 5 && isValidURL(last)) addSource()
}

const removeSource = (index: number) => {
  sources.value.splice(index, 1)
}

watch(
  () => sources.value,
  (val) => {
    const last = val[val.length - 1]
    if (last && last.trim().length > 5 && isValidURL(last) && !val[val.length]) addSource()
  },
  { deep: true },
)

onMounted(() => {
  if (!sources.value.length) addSource()
})
</script>
