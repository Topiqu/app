<template>
  <section v-if="targetLanguages.length" class="flex flex-col gap-4">
    <header class="flex items-center gap-2">
      <Icon name="mdi:translate" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
      <h2 class="font-semibold text-sm text-gray-900 dark:text-gray-100">
        {{ $t('articles.translations.title') }}
      </h2>
      <span
        v-if="reviewCount"
        class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      >
        {{ $t('articles.translations.awaitingReview', reviewCount, { count: reviewCount }) }}
      </span>
    </header>

    <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">{{ $t('articles.translations.desc') }}</p>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="lang in targetLanguages"
        :key="lang"
        variant="neutral"
        class="!px-3 !py-1 !min-h-0 !h-auto !text-xs !font-medium !rounded-full border inline-flex items-center gap-1.5"
        :class="
          lang === activeLang
            ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
        "
        @click="activeLang = lang"
      >
        {{ $t(`languages.${lang}`) }}
        <span class="w-1.5 h-1.5 rounded-full" :class="dotClass(byLanguage[lang]?.status)" />
      </Button>
    </div>

    <div class="rounded-2xl border border-gray-200 dark:border-neutral-700 p-5 flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3 text-xs">
        <span class="px-2 py-0.5 rounded-full font-medium" :class="statusClass(active?.status)">
          {{ $t(`articles.translations.status.${active?.status ?? 'MISSING'}`) }}
        </span>
        <span v-if="active?.source" class="text-gray-500 dark:text-gray-400">
          {{ $t(`articles.translations.source.${active.source}`) }}
        </span>
        <AppTime
          v-if="active?.translatedAt"
          :datetime="active.translatedAt"
          preset="shortDatetime"
          class="text-gray-500 dark:text-gray-400"
        />
      </div>

      <p v-if="active?.error" class="text-xs text-red-600 dark:text-red-400">{{ active.error }}</p>

      <template v-if="hasBody">
        <FormField v-model="draft.title" :label="$t('articles.translations.fields.title')" type="text" />
        <div class="flex flex-col gap-2">
          <FormLabel :text="$t('articles.translations.fields.excerpt')" />
          <FormField v-model="draft.excerpt" type="textarea" :maxLength="500" />
        </div>
        <div class="flex flex-col gap-2">
          <FormLabel :text="$t('articles.translations.fields.content')" />
          <TiptapEditor v-model="draft.content" edit contentClass="min-h-[30vh]" />
        </div>
      </template>

      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t(`articles.translations.empty.${active?.status ?? 'MISSING'}`) }}
      </p>

      <div
        class="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-gray-200 dark:border-neutral-700 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl"
      >
        <Button
          v-if="hasBody"
          size="sm"
          icon="mdi:content-save-outline"
          :disabled="!isDirty"
          :loading="pending === 'save'"
          @click="save()"
        >
          {{ $t('common.actions.save') }}
        </Button>
        <Button
          v-if="hasBody && active?.status !== 'PUBLISHED'"
          size="sm"
          variant="success"
          icon="mdi:check-circle-outline"
          :loading="pending === 'publish'"
          @click="save('PUBLISHED')"
        >
          {{ $t('articles.translations.actions.approve') }}
        </Button>
        <Button
          size="sm"
          variant="neutral"
          icon="mdi:auto-fix"
          :loading="pending === 'translate'"
          @click="translateNow"
        >
          {{ active ? $t('articles.translations.actions.retranslate') : $t('articles.translations.actions.translate') }}
        </Button>
        <Button
          v-if="active"
          size="sm"
          variant="danger"
          icon="mdi:trash-can-outline"
          :loading="pending === 'discard'"
          @click="discardOpen = true"
        >
          {{ $t('articles.translations.actions.discard') }}
        </Button>

        <span
          v-if="hasBody && isDirty"
          class="ml-auto inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
          aria-live="polite"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {{ $t('articles.translations.unsaved') }}
        </span>
      </div>
    </div>

    <ModalMini
      v-model:open="discardOpen"
      icon="mdi:alert-circle-outline"
      variant="danger"
      :title="$t('articles.translations.discardTitle')"
      :message="$t('articles.translations.discardMessage')"
      :confirmText="$t('articles.translations.actions.discard')"
      :cancelText="$t('common.actions.cancel')"
      @confirm="discard"
    />
  </section>
</template>

<script setup lang="ts">
import {
  isTranslationDirty,
  resolveActiveLanguage,
  translationDraft,
  translationHasBody,
  type TranslationStatus,
} from '~~/shared/utils/articleTranslations'

const props = defineProps<{ articleId: string }>()

const toast = useToast()
const { t } = useI18n()

const { translations, targetLanguages, byLanguage, reviewCount, refresh } = useArticleTranslations(props.articleId)

const activeLang = shallowRef('')
watchEffect(() => {
  activeLang.value = resolveActiveLanguage(translations.value, targetLanguages.value, activeLang.value)
})

const active = computed(() => byLanguage.value[activeLang.value])
const hasBody = computed(() => translationHasBody(active.value))

const draft = ref(translationDraft())
const pristine = ref(translationDraft())

watch(
  active,
  (row) => {
    draft.value = translationDraft(row)
    pristine.value = translationDraft(row)
  },
  { immediate: true },
)

const isDirty = computed(() => isTranslationDirty(draft.value, pristine.value))

const pending = shallowRef<'save' | 'publish' | 'translate' | 'discard' | null>(null)
const discardOpen = shallowRef(false)

const dotClass = (status?: TranslationStatus) => {
  if (status === 'PUBLISHED') return 'bg-emerald-500'
  if (status === 'READY') return 'bg-amber-500'
  if (status === 'FAILED') return 'bg-red-500'
  if (status === 'STALE') return 'bg-orange-500'
  if (status) return 'bg-blue-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

const statusClass = (status?: TranslationStatus) => {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (status === 'READY') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  if (status === 'FAILED') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  return 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300'
}

const run = async (kind: NonNullable<typeof pending.value>, fn: () => Promise<unknown>, successKey: string) => {
  if (pending.value) return
  pending.value = kind
  try {
    await fn()
    await refresh()
    toast.success({ message: t(successKey) })
  } catch (e: any) {
    toast.error({ message: e?.data?.message || t('common.messages.saveFailed') })
  } finally {
    pending.value = null
  }
}

const save = (status?: 'PUBLISHED') =>
  run(
    status ? 'publish' : 'save',
    () =>
      $fetch<unknown>(`/api/translations/${active.value!.id}`, {
        method: 'PATCH',
        body: {
          title: draft.value.title,
          excerpt: draft.value.excerpt || null,
          content: draft.value.content,
          ...(status ? { status } : {}),
        },
      }),
    status ? 'articles.translations.messages.published' : 'common.messages.saveSuccess',
  )

const translateNow = () =>
  run(
    'translate',
    () =>
      $fetch<unknown>(`/api/articles/${props.articleId}/translate`, {
        method: 'POST',
        body: { language: activeLang.value },
      }),
    'articles.translations.messages.translated',
  )

const discard = () =>
  run(
    'discard',
    () => $fetch<unknown>(`/api/translations/${active.value!.id}`, { method: 'DELETE' }),
    'articles.translations.messages.discarded',
  )
</script>
