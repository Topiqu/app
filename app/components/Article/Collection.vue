<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col sm:flex-row gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700">
      <FormInput v-model="search" :placeholder="$t('articles.searchPlaceholder')" />
      <FormSelect v-model="sort" :items="sortItems" :showValue="false" />
    </div>

    <div v-if="pending" class="grid gap-6" aria-busy="true">
      <div
        v-for="i in 6"
        :key="i"
        aria-hidden="true"
        class="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm p-6 animate-pulse"
      >
        <div class="flex gap-4">
          <div class="bg-gray-200 dark:bg-neutral-800 rounded-xl w-48 h-[120px]" />
          <div class="flex-1 space-y-3">
            <div class="h-6 bg-gray-200 dark:bg-neutral-800 rounded w-3/4" />
            <div class="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-full" />
            <div class="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-5/6" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="articles.length" class="grid gap-6">
      <article
        v-for="a in articles"
        :key="a.id"
        class="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
      >
        <NuxtLink
          :to="localePath({ name: 'clanky-slug', params: { slug: a.slug } })"
          class="flex flex-col sm:flex-row items-stretch gap-4 p-6 no-underline group"
        >
          <div class="relative">
            <NuxtImg
              v-if="a.imageUrl"
              :src="a.imageUrl"
              :alt="$t('articles.articleCard.imageAlt')"
              format="webp"
              quality="80"
              width="160"
              height="100"
              class="rounded-xl border border-gray-100 dark:border-neutral-800 object-cover w-full sm:w-48 h-[120px] group-hover:brightness-105 transition"
            />
            <div
              v-else
              class="w-full sm:w-48 h-[120px] rounded-xl border border-gray-100 dark:border-neutral-800 flex items-center justify-center bg-gray-50 dark:bg-neutral-800 text-gray-400"
            >
              <Icon name="mdi:image-off" class="w-8 h-8" />
            </div>
          </div>
          <div class="flex flex-col justify-between gap-3 flex-1">
            <div class="flex flex-col gap-2">
              <h2
                class="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight"
              >
                {{ a.title }}
              </h2>
              <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 pt-1">
                <template v-if="isStaff">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium"
                  >
                    <Icon
                      :name="a.status === 'draft' ? 'mdi:pencil-outline' : 'mdi:check-circle-outline'"
                      class="w-4 h-4"
                    />
                    {{ a.status === 'draft' ? $t('articles.status.draft') : $t('articles.status.published') }}
                  </span>
                  <span>•</span>
                </template>
                <span class="inline-flex items-center gap-1">
                  <Icon name="mdi:calendar" class="w-4 h-4 text-gray-400" />
                  {{ formatDate(a.createdAt) }}
                </span>
                <span>•</span>
                <span class="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400 font-medium">
                  <Icon name="mdi:account-outline" class="w-4 h-4" />
                  {{ a.user?.username }}
                </span>
                <span>•</span>
                <span class="inline-flex items-center gap-1">
                  <Icon
                    name="mdi:eye"
                    class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition"
                  />
                  {{ a.views }} {{ $t('stats.totalViews.title') }}
                </span>
                <span>•</span>
                <span class="inline-flex items-center gap-1 group-hover:text-red-500 transition">
                  <Icon name="mdi:heart" class="w-4 h-4 text-gray-400 group-hover:scale-110 transition" />
                  {{ a.likes }} {{ $t('profile.likes') }}
                </span>
              </div>
            </div>
          </div>
        </NuxtLink>
      </article>

      <Pagination :page="page" :totalPages="totalPages" :nextPage="nextPage" :prevPage="prevPage" />
    </div>

    <p v-else class="text-gray-500 dark:text-gray-400 italic text-center py-8 text-lg">
      {{ $t('articles.noResults.message') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

import { formatDate } from '~~/shared/utils'

const props = defineProps<{
  articles: ArticleCardData[]
  pending: boolean
  hasMore: boolean
}>()

const search = defineModel<string>('search', { required: true })
const sort = defineModel<string>('sort', { required: true })
const page = defineModel<number>('page', { required: true })

const localePath = useLocalePath()
const auth = useAuth().data

const isStaff = computed(() => auth.value?.user.role === 'admin' || auth.value?.user.role === 'superadmin')

const totalPages = computed(() => (props.hasMore ? page.value + 1 : page.value))
const nextPage = () => {
  if (props.hasMore) page.value++
}
const prevPage = () => {
  if (page.value > 1) page.value--
}

const sortItems = computed(() => [
  { value: 'createdAt:desc', label: $t('common.sortOptions.newest') },
  { value: 'createdAt:asc', label: $t('common.sortOptions.oldest') },
  { value: 'title:asc', label: $t('common.labels.title') + ' A-Z' },
  { value: 'title:desc', label: $t('common.labels.title') + ' Z-A' },
])
</script>
