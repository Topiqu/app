<template>
  <UModal v-model:open="open" :title="$t('articles.preferencesExplanation.title')">
    <slot :open="openDialog" />

    <template #body>
      <div class="flex flex-col divide-y divide-default">
        <section class="py-6">
          <div class="flex items-center gap-2 mb-2">
            <UIcon size="20" name="i-mdi-bullseye" />
            <h3 class="text-sm font-semibold text-muted uppercase tracking-widest">
              {{ $t('articles.preferencesExplanation.focus.title') }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-highlighted">
            {{ $t('articles.preferencesExplanation.focus.description') }}
          </p>
          <p class="mt-2 text-sm italic text-muted">
            {{ $t('articles.preferencesExplanation.focus.example') }}
          </p>
        </section>
        <section class="py-6">
          <div class="flex items-center gap-2 mb-2">
            <UIcon size="20" name="i-mdi-account-group-outline" />
            <h3 class="text-sm font-semibold text-muted uppercase tracking-widest">
              {{ $t('articles.preferencesExplanation.targetAudience.title') }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-highlighted">
            {{ $t('articles.preferencesExplanation.targetAudience.description') }}
          </p>
          <p class="mt-2 text-sm italic text-muted">
            {{ $t('articles.preferencesExplanation.targetAudience.example') }}
          </p>
        </section>
        <section class="py-6">
          <div class="flex items-center gap-2 mb-2">
            <UIcon size="20" name="i-mdi-tag-multiple-outline" />
            <h3 class="text-sm font-semibold text-muted uppercase tracking-widest">
              {{ $t('articles.preferencesExplanation.keywords.title') }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-highlighted">
            {{ $t('articles.preferencesExplanation.keywords.description') }}
          </p>
          <p class="mt-2 text-sm italic text-muted">
            {{ $t('articles.preferencesExplanation.keywords.example') }}
          </p>
        </section>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" size="lg" @click="close">{{ $t('common.close') }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ default: false })
const openDialog = () => (open.value = true)
</script>
