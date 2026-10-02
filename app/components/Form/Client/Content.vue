<template>
  <div class="space-y-10">
    <header>
      <h2 class="text-xl font-bold text-highlighted">{{ $t('common.preferences.content.title') }}</h2>
      <p class="mt-1 max-w-2xl text-sm leading-6 text-muted">{{ $t('common.preferences.content.description') }}</p>
    </header>

    <section class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.content.direction.title') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.content.direction.description') }}</p>
      </div>

      <div
        class="grid gap-x-8 gap-y-6 rounded-(--topiqu-surface-radius) border border-default bg-default p-5 sm:p-6 lg:grid-cols-2"
      >
        <div class="flex min-w-0 flex-col gap-2">
          <AppFormLabel :forId="focusId" :text="$t('common.preferences.focus.label')" />
          <UTextarea
            :id="focusId"
            v-model="focus"
            :aria-describedby="focusHelpId"
            :placeholder="$t('common.preferences.focus.placeholder')"
            :rows="3"
            autoresize
          />
          <p :id="focusHelpId" class="text-xs leading-5 text-muted">{{ $t('common.preferences.focus.help') }}</p>
        </div>

        <div class="flex min-w-0 flex-col gap-2">
          <AppFormLabel :forId="audienceId" :text="$t('common.preferences.audience.label')" />
          <UTextarea
            :id="audienceId"
            v-model="audience"
            :aria-describedby="audienceHelpId"
            :placeholder="$t('common.preferences.audience.placeholder')"
            :rows="3"
            autoresize
          />
          <p :id="audienceHelpId" class="text-xs leading-5 text-muted">
            {{ $t('common.preferences.audience.help') }}
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.content.topics.title') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.content.topics.description') }}</p>
      </div>

      <div
        class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
      >
        <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div class="min-w-0">
            <AppFormLabel :forId="languageId" :text="$t('common.preferences.language.label')" />
            <p :id="languageHelpId" class="mt-1 text-sm leading-5 text-muted">
              {{ $t('common.preferences.language.help') }}
            </p>
          </div>
          <USelect
            :id="languageId"
            v-model="language"
            :items="languageItems"
            :aria-describedby="languageHelpId"
            class="w-full shrink-0 sm:w-48"
          />
        </div>

        <div class="flex flex-col gap-2 p-5 sm:p-6">
          <AppFormLabel :forId="keywordsId" :text="$t('common.preferences.keywords.label')" />
          <p class="text-sm leading-5 text-muted">{{ $t('common.preferences.keywords.help') }}</p>
          <UInputTags
            :id="keywordsId"
            v-model="keywordTags"
            addOnPaste
            addOnBlur
            :aria-describedby="keywordsHintId"
            :placeholder="$t('common.preferences.keywords.placeholder')"
            class="mt-1 w-full"
            :ui="{ item: 'rounded-full ps-2.5', itemText: 'break-words [overflow-wrap:anywhere]' }"
          />
          <p :id="keywordsHintId" class="text-xs leading-5 text-muted">
            {{ $t('common.preferences.keywords.hint') }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Language } from '~~/shared/utils/language'

import { LanguageSchema } from '~~/shared/siteSchemas'

import { addKeywords } from '~/utils/keywords'

const focus = defineModel<string>('focus', { required: true })
const audience = defineModel<string>('audience', { required: true })
const language = defineModel<Language>('language', { required: true })
const keywords = defineModel<string[]>('keywords', { required: true })

const focusId = useId()
const focusHelpId = useId()
const audienceId = useId()
const audienceHelpId = useId()
const languageId = useId()
const languageHelpId = useId()
const keywordsId = useId()
const keywordsHintId = useId()
const { t } = useI18n()

const languageItems = computed(() => LanguageSchema.options.map((value) => ({ value, label: t(`languages.${value}`) })))

// UInputTags only dedupes exact matches; addKeywords also trims and ignores case.
const keywordTags = computed({
  get: () => keywords.value,
  set: (tags: string[]) => (keywords.value = tags.reduce(addKeywords, [])),
})
</script>
