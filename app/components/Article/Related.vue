<template>
  <section v-if="articles.length" class="mt-20">
    <h2 class="text-2xl font-bold text-gray-900 mb-8 tracking-tight">Související články</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink
        v-for="{ article: a } in articles"
        :key="a.id"
        :to="`/articles/${a.slug}`"
        class="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-transform duration-300 no-underline"
      >
        <NuxtImg
          v-if="a.imageUrl"
          :src="a.imageUrl"
          :alt="`Titulní obrázek k článku: ${a.title}`"
          format="webp"
          quality="80"
          width="320"
          height="160"
          class="w-full h-[120px] object-cover rounded-t-2xl border-b border-gray-100"
        />
        <div class="p-4 flex flex-col gap-2 flex-grow">
          <h3 class="text-base font-semibold text-gray-900 line-clamp-2">
            {{ a.title }}
          </h3>
          <div class="text-xs text-gray-500 flex items-center gap-2">
            <Icon name="mdi:calendar" class="w-4 h-4 text-gray-400" />
            {{ formatDate(a.createdAt.toString()) }}
            <span class="mx-1">•</span>
            <Icon name="mdi:account" class="w-4 h-4 text-gray-400" />
            <span class="truncate">{{ a.user.username }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Article as _Article } from '@zenstackhq/runtime/models'

type RelatedArticle = { article: _Article & { user: { username: string } } }

defineProps<{ articles: RelatedArticle[] }>()
</script>
