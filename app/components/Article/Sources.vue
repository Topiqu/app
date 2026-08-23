<template>
  <fieldset class="space-y-3">
    <legend class="mb-2 text-sm font-medium text-highlighted">{{ $t('articles.columns.sources') }}</legend>
    <ol class="space-y-3">
      <li
        v-for="(source, index) in sources"
        :key="index"
        class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_auto]"
      >
        <span class="flex size-8 items-center justify-center text-sm font-bold tabular-nums text-muted">
          {{ index + 1 }}
        </span>
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
        <div v-if="source" class="col-start-2 flex min-w-0 items-center gap-2 sm:col-start-auto sm:h-10">
          <AppMedia
            :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${source}&size=32`"
            :alt="extractDomain(source)"
            :fallbackText="extractDomain(source)"
            aspectRatio="1 / 1"
            fit="contain"
            sizes="24px"
            containerClass="size-6 shrink-0 rounded-[var(--ui-radius)]"
          />
          <span class="min-w-0 truncate text-sm text-muted">{{ extractDomain(source) }}</span>
        </div>
        <UButton
          icon="i-mdi-delete"
          color="error"
          variant="ghost"
          square
          :aria-label="$t('common.actions.delete')"
          @click="removeSource(index)"
        />
      </li>
    </ol>
    <UButton icon="i-mdi-plus" color="neutral" variant="soft" size="sm" @click="addSource">
      {{ $t('articles.tags.addButton') }}
    </UButton>
  </fieldset>
</template>

<script setup lang="ts">
const sources = defineModel<string[]>({ required: true })

defineProps<{ compact?: boolean }>()

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
