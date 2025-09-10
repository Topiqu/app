<template>
  <Modal v-model="open" :title="$t('articles.preferencesExplanation.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col divide-y divide-gray-200 dark:divide-gray-700 mt-6">
        <section class="py-6">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="mdi:bullseye" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {{ $t('articles.preferencesExplanation.focus.title') }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-gray-700 dark:text-gray-200">
            {{ $t('articles.preferencesExplanation.focus.description') }}
          </p>
          <p class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
            {{ $t('articles.preferencesExplanation.focus.example') }}
          </p>
        </section>
        <section class="py-6">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="mdi:account-group-outline" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {{ $t('articles.preferencesExplanation.targetAudience.title') }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-gray-700 dark:text-gray-200">
            {{ $t('articles.preferencesExplanation.targetAudience.description') }}
          </p>
          <p class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
            {{ $t('articles.preferencesExplanation.targetAudience.example') }}
          </p>
        </section>
        <section class="py-6">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="mdi:tag-multiple-outline" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {{ $t('articles.preferencesExplanation.keywords.title') }}
            </h3>
          </div>
          <p class="text-base leading-relaxed text-gray-700 dark:text-gray-200">
            {{ $t('articles.preferencesExplanation.keywords.description') }}
          </p>
          <p class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
            {{ $t('articles.preferencesExplanation.keywords.example') }}
          </p>
        </section>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-5 py-2.5 rounded-xl text-sm font-medium transition hover:scale-105 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm"
        @click="close"
      >
        {{ $t('articles.preferencesExplanation.closeButton') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()
</script>
