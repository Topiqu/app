<template>
  <section
    :aria-labelledby="titleId"
    aria-keyshortcuts="ArrowLeft ArrowRight"
    class="rounded-(--topiqu-surface-radius) border border-default bg-elevated/40 p-4 sm:p-5"
    @keydown.left.prevent="move(-1)"
    @keydown.right.prevent="move(1)"
  >
    <p :id="titleId" class="mb-2 text-xs font-medium text-muted">
      {{ t('common.preferences.guide.examples.title') }}
      <span aria-hidden="true" class="tabular-nums">· {{ activeIndex + 1 }}/{{ examples.length }}</span>
    </p>
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="min-w-0 text-lg font-semibold text-highlighted">{{ activeTitle }}</h3>
      <div class="flex shrink-0 gap-1">
        <UButton
          square
          color="neutral"
          variant="ghost"
          icon="mdi:chevron-left"
          :aria-label="t('common.preferences.guide.examples.previous')"
          @click="move(-1)"
        />
        <UButton
          square
          color="neutral"
          variant="ghost"
          icon="mdi:chevron-right"
          :aria-label="t('common.preferences.guide.examples.next')"
          @click="move(1)"
        />
      </div>
    </div>

    <p class="sr-only" role="status" aria-atomic="true">{{ position }}</p>

    <!-- Every example shares one grid cell, so the longest reserves the height and switching never shifts layout. -->
    <div class="grid">
      <dl
        v-for="(example, index) in examples"
        :key="example"
        class="divide-y divide-default [grid-area:1/1] transition-opacity duration-150 motion-reduce:transition-none"
        :class="index === activeIndex ? 'opacity-100' : 'invisible opacity-0'"
        :aria-hidden="index !== activeIndex"
        :inert="index !== activeIndex"
      >
        <div
          v-for="field in fields"
          :key="field"
          class="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5"
        >
          <dt class="text-sm font-semibold text-highlighted">
            {{ t(`common.preferences.${field}.label`) }}
            <span class="block text-xs font-normal text-muted">{{ t(`common.preferences.guide.fields.${field}`) }}</span>
          </dt>
          <dd class="min-w-0 text-sm text-toned [overflow-wrap:anywhere]">
            {{
              field === 'language'
                ? t(`languages.${locale}`)
                : t(`common.preferences.guide.examples.items.${example}.${field}`)
            }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const titleId = useId()
const examples = ['gaming', 'coffee', 'software', 'travel', 'running'] as const
const fields = ['focus', 'audience', 'language', 'keywords'] as const
const activeIndex = shallowRef(0)

const activeTitle = computed(() => t(`common.preferences.guide.examples.items.${examples[activeIndex.value]}.title`))
const position = computed(() =>
  t('common.preferences.guide.examples.position', {
    current: activeIndex.value + 1,
    total: examples.length,
    title: activeTitle.value,
  }),
)

const move = (step: number) => {
  activeIndex.value = (activeIndex.value + step + examples.length) % examples.length
}
</script>
