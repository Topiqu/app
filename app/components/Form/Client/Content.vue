<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-xl font-bold text-neutral-900 dark:text-white">{{ $t('common.preferences.content.title') }}</h2>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('common.preferences.content.description') }}
      </p>
    </div>

    <div
      class="divide-y divide-neutral-200 rounded-(--topiqu-surface-radius) border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <AppFormLabel
            :forId="focusId"
            :text="$t('common.preferences.focus.label')"
            icon="mdi:bullseye"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.focus.help') }}
          </p>
        </div>
        <UTextarea :id="focusId" v-model="focus" :placeholder="$t('common.preferences.focus.placeholder')" />
      </div>

      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <AppFormLabel
            :forId="audienceId"
            :text="$t('common.preferences.audience.label')"
            icon="mdi:account-group-outline"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.audience.help') }}
          </p>
        </div>
        <UTextarea :id="audienceId" v-model="audience" :placeholder="$t('common.preferences.audience.placeholder')" />
      </div>

      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <AppFormLabel
            :id="languageLabelId"
            :text="$t('common.preferences.language.label')"
            icon="mdi:translate"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.language.help') }}
          </p>
        </div>
        <UFormField :label="$t('common.preferences.language.label')" :ui="{ label: 'sr-only' }">
          <URadioGroup v-model="language" :items="languageItems" orientation="horizontal" variant="card" />
        </UFormField>
      </div>

      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <AppFormLabel
            :forId="keywordsId"
            :text="$t('common.preferences.keywords.label')"
            icon="mdi:tag-multiple-outline"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.keywords.help') }}
          </p>
        </div>
        <div class="min-w-0">
          <div
            class="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-2 py-2 transition focus-within:ring-2 focus-within:ring-indigo-500 dark:border-neutral-600 dark:bg-neutral-700"
            @click="keywordField?.focus()"
          >
            <span
              v-for="(keyword, index) in keywords"
              :key="keyword"
              class="inline-flex items-center gap-1 rounded-md bg-indigo-100 py-1 pl-2.5 pr-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              {{ keyword }}
              <UButton
                type="button"
                size="xs"
                square
                color="error"
                variant="ghost"
                icon="mdi:close"
                :aria-label="$t('common.preferences.keywords.remove', [keyword])"
                @click.stop="removeKeyword(index)"
              />
            </span>

            <UInput
              :id="keywordsId"
              ref="keywordField"
              v-model="draft"
              type="text"
              :placeholder="keywords.length ? '' : $t('common.preferences.keywords.placeholder')"
              @keydown="onKeywordKeydown"
              @paste="onKeywordPaste"
              @blur="commit(draft)"
            />
          </div>

          <p class="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{{ $t('common.preferences.keywords.hint') }}</span>
            <span v-if="keywords.length" class="font-medium text-neutral-600 dark:text-neutral-300">
              {{ $t('common.preferences.keywords.count', [keywords.length]) }}
            </span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { LanguageSchema } from '~~/shared/zod/enums'

import { addKeywords } from '~/utils/keywords'

const props = defineProps<{
  focus: string
  audience: string
  language: string
  keywords: string[]
}>()

const emit = defineEmits<{
  'update:focus': [string]
  'update:audience': [string]
  'update:language': [string]
  'update:keywords': [string[]]
}>()

const focusId = useId()
const audienceId = useId()
const languageLabelId = useId()
const keywordsId = useId()

const focus = computed({
  get: () => props.focus,
  set: (v) => emit('update:focus', v),
})

const audience = computed({
  get: () => props.audience,
  set: (v) => emit('update:audience', v),
})

const language = computed<'cs' | 'en'>({
  get: () => (props.language === 'cs' ? 'cs' : 'en'),
  set: (v) => emit('update:language', v),
})

const languageItems = LanguageSchema.options.map((lang) => ({
  value: lang,
  label: $t(`languages.${lang}`),
}))

const keywordField = useTemplateRef<HTMLInputElement>('keywordField')
const draft = shallowRef('')

const commit = (raw: string) => {
  const next = addKeywords(props.keywords, raw)
  if (next !== props.keywords) emit('update:keywords', next)
  draft.value = ''
}

const removeKeyword = (index: number) => emit('update:keywords', props.keywords.toSpliced(index, 1))

const onKeywordKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit(draft.value)
  } else if (event.key === 'Backspace' && !draft.value && props.keywords.length) {
    removeKeyword(props.keywords.length - 1)
  }
}

// A pasted comma list becomes chips instead of one keyword holding the whole line.
const onKeywordPaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!text.includes(',')) return
  event.preventDefault()
  commit(draft.value + text)
}
</script>
