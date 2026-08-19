<template>
  <div class="min-h-[100dvh] bg-default px-4 py-12 sm:px-6 lg:px-8">
    <article class="mx-auto max-w-[var(--topiqu-reading-width)]">
      <header class="mb-12 border-b border-default pb-8">
        <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          {{ $t('legal.tos.title') }}
        </h1>
        <p class="text-muted">
          {{ $t('legal.lastUpdated', { date: '1. 1. 2026' }) }}
        </p>
      </header>

      <!-- Content -->
      <div class="space-y-10 text-toned leading-relaxed text-lg">
        <section v-for="(section, index) in sections" :key="index" class="group">
          <h2 class="text-2xl font-semibold text-highlighted mb-4 flex items-center gap-3">
            <span class="flex items-center justify-center w-10 h-10 rounded-lg bg-elevated">
              <UIcon name="i-mdi-file-document-outline" size="24" />
            </span>
            {{ rt(section.title) }}
          </h2>
          <div class="pl-13" v-html="rt(section.content)"></div>
        </section>
      </div>

      <div class="mt-16 pt-8 border-t border-default flex justify-center">
        <UButton to="/" size="lg" icon="i-mdi-arrow-left">
          {{ $t('common.actions.home') }}
        </UButton>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
const { rt, t, tm } = useI18n()

const sections = computed(() => tm('legal.tos.sections') as any[])

useSeoMeta({
  title: () => t('legal.tos.title'),
  description: () => t('legal.tos.description'),
})
</script>
