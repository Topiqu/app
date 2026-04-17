<template>
  <div class="min-h-screen bg-gray-50 dark:bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
    <div class="max-w-4xl mx-auto relative">
      <!-- Decorator glow -->
      <div
        class="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/20 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
      ></div>

      <!-- Main card -->
      <div
        class="relative bg-white dark:bg-neutral-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-neutral-800 p-8 sm:p-12 overflow-hidden"
      >
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            <span class="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {{ $t('legal.tos.title') }}
            </span>
          </h1>
          <p class="text-gray-500 dark:text-gray-400">
            {{ $t('legal.lastUpdated', { date: '1. 1. 2026' }) }}
          </p>
        </div>

        <!-- Content -->
        <div class="space-y-10 text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
          <section v-for="(section, index) in sections" :key="index" class="group">
            <h2
              class="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-3 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400"
            >
              <span
                class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 dark:bg-neutral-800 shadow-inner group-hover:scale-110 transition-transform"
              >
                <Icon :name="section.icon" :class="['w-6 h-6', section.iconColor]" />
              </span>
              {{ section.title }}
            </h2>
            <div class="pl-13 opacity-90 hover:opacity-100 transition-opacity" v-html="section.content"></div>
          </section>
        </div>

        <!-- Footer action -->
        <div class="mt-16 pt-8 border-t border-gray-100 dark:border-neutral-800 flex justify-center">
          <NuxtLink
            to="/"
            class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
          >
            <Icon name="mdi:arrow-left" class="w-5 h-5 mr-2" />
            {{ $t('common.actions.home') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, tm } = useI18n()

const sections = computed(() => tm('legal.tos.sections') as any[])

useSeoMeta({
  title: () => t('legal.tos.title'),
  description: () => t('legal.tos.description'),
})
</script>
