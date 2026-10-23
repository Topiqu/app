<template>
  <section class="space-y-4">
    <div>
      <h3 :id="titleId" class="text-base font-semibold text-highlighted">
        {{ $t('common.preferences.articleQuality.title') }}
      </h3>
      <p :id="helpId" class="mt-1 text-sm text-muted">
        {{ $t('common.preferences.articleQuality.description') }}
      </p>
    </div>
    <URadioGroup
      v-model="quality"
      :items="items"
      :aria-labelledby="titleId"
      :aria-describedby="helpId"
      variant="card"
      :ui="{ fieldset: 'grid gap-3 sm:grid-cols-3' }"
    />
  </section>
</template>

<script setup lang="ts">
import type { ArticleQuality } from '~~/shared/utils/articleQuality'

const quality = defineModel<ArticleQuality>({ required: true })
const { t } = useI18n()
const titleId = useId()
const helpId = useId()
const items = computed(() =>
  ARTICLE_QUALITY_LEVELS.map((value) => ({
    value,
    label: t(`common.preferences.articleQuality.options.${value}`),
    description: t('common.preferences.articleQuality.cost', articleCreditCost(value)),
  })),
)
</script>
