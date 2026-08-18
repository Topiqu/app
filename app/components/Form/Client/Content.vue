<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-xl font-bold text-neutral-900 dark:text-white">{{ $t('common.preferences.content.title') }}</h2>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('common.preferences.content.description') }}
      </p>
    </div>

    <div
      class="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <FormLabel
            :for="focusId"
            :text="$t('common.preferences.focus.label')"
            icon="mdi:bullseye"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.focus.help') }}
          </p>
        </div>
        <FormInput
          :id="focusId"
          v-model="focus"
          type="textarea"
          inputClass="h-20! min-h-11!"
          :placeholder="$t('common.preferences.focus.placeholder')"
        />
      </div>

      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <FormLabel
            :for="audienceId"
            :text="$t('common.preferences.audience.label')"
            icon="mdi:account-group-outline"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.audience.help') }}
          </p>
        </div>
        <FormInput
          :id="audienceId"
          v-model="audience"
          type="textarea"
          inputClass="h-20! min-h-11!"
          :placeholder="$t('common.preferences.audience.placeholder')"
        />
      </div>

      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <FormLabel
            :id="languageLabelId"
            as="span"
            :text="$t('common.preferences.language.label')"
            icon="mdi:translate"
            class="p-0! font-semibold!"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.language.help') }}
          </p>
        </div>
        <div role="radiogroup" :aria-labelledby="languageLabelId" class="flex flex-wrap gap-2 self-start">
          <label v-for="option in languageItems" :key="option.value">
            <input v-model="language" type="radio" name="content-language" :value="option.value" class="peer sr-only" />
            <span
              class="block cursor-pointer rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:peer-checked:border-neutral-100 dark:peer-checked:bg-neutral-100 dark:peer-checked:text-neutral-900 dark:peer-focus-visible:ring-offset-neutral-900"
            >
              {{ option.label }}
            </span>
          </label>
        </div>
      </div>

      <div class="grid gap-x-8 gap-y-2.5 p-5 sm:p-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div>
          <FormLabel
            :for="keywordsId"
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
              <button
                type="button"
                class="grid size-5 place-items-center rounded text-indigo-500/70 transition hover:bg-indigo-500/15 hover:text-indigo-700 dark:hover:text-indigo-100"
                :aria-label="$t('common.preferences.keywords.remove', [keyword])"
                @click.stop="removeKeyword(index)"
              >
                <Icon name="mdi:close" class="size-3.5" />
              </button>
            </span>

            <input
              :id="keywordsId"
              ref="keywordField"
              v-model="draft"
              type="text"
              class="min-w-40 flex-1 bg-transparent px-1.5 py-1 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-neutral-400"
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

const language = computed({
  get: () => props.language,
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
