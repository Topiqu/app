<template>
  <section
    class="@container overflow-hidden rounded-(--topiqu-surface-radius)"
    :class="
      config.tone === 'accent' && !preview
        ? 'bg-[var(--topiqu-cta-bg,var(--ui-primary))] text-[var(--topiqu-cta-fg,var(--ui-bg))] dark:bg-[var(--topiqu-cta-dark-bg,var(--ui-primary))]'
        : 'border border-default bg-default text-default'
    "
    :aria-labelledby="titleId"
  >
    <!-- Container queries: the same widget sits full-width on the homepage and in a narrow editor preview. -->
    <div class="grid items-center gap-5 p-5 @md:p-6" :class="{ '@xl:grid-cols-[2fr_1fr]': config.image?.url }">
      <div class="min-w-0 space-y-3">
        <h2 :id="titleId" class="text-lg font-semibold tracking-tight text-balance break-words @md:text-xl">
          {{ config.title }}
        </h2>
        <p v-if="config.text" class="text-sm leading-relaxed text-pretty break-words opacity-90">{{ config.text }}</p>
        <UButton
          :to="config.button.url"
          :target="config.button.url.startsWith('https://') ? '_blank' : undefined"
          size="md"
          :color="config.tone === 'accent' ? 'neutral' : 'primary'"
          class="mt-1 max-w-full"
        >
          {{ config.button.label }}
        </UButton>
      </div>
      <NuxtImg
        v-if="config.image?.url"
        :src="config.image.url"
        :alt="config.image.alt"
        loading="lazy"
        sizes="xs:100vw phone:100vw sm:100vw md:400px"
        class="aspect-[4/3] w-full rounded-xl object-cover"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CtaConfig } from '~~/shared/utils/widgets'

const { config, preview = false } = defineProps<{ config: CtaConfig; preview?: boolean }>()
const titleId = useId()
</script>
