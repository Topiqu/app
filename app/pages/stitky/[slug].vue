<template>
  <div class="min-h-screen bg-gradient-to-br">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <Back />
      <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-center">
        <span class="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">{{ tagName }}</span>
        {{ $t('articles.tagsArticles') }}
      </h1>
      <div class="flex flex-col sm:flex-row gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700">
        <FormInput v-model="search" :placeholder="$t('articles.searchPlaceholder')" />
        <FormSelect v-model="sort" :items="sortItems" :showValue="false" />
      </div>
      <div v-if="pending" class="grid gap-6">
        <div
          v-for="i in 6"
          :key="i"
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
      <div v-else-if="paginated.length" class="grid gap-6">
        <div
          v-for="a in paginated"
          :key="a.articleId"
          class="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
        >
          <NuxtLink
            :to="localePath({ name: 'clanky-slug', params: { slug: a.article.slug } })"
            class="flex flex-col sm:flex-row items-stretch gap-4 p-6 no-underline group"
            ><div class="relative">
              <NuxtImg
                v-if="a.article.imageUrl"
                :src="a.article.imageUrl"
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
                  {{ a.article.title }}
                </h2>
                <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 pt-1">
                  <template v-if="auth?.user.role === 'admin' || auth?.user.role === 'superadmin'"
                    ><span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium"
                      ><Icon
                        :name="a.article.status === 'draft' ? 'mdi:pencil-outline' : 'mdi:check-circle-outline'"
                        class="w-4 h-4"
                      />{{
                        a.article.status === 'draft' ? $t('articles.status.draft') : $t('articles.status.published')
                      }}</span
                    ><span>•</span></template
                  ><span class="inline-flex items-center gap-1"
                    ><Icon name="mdi:calendar" class="w-4 h-4 text-gray-400" />{{
                      formatDate(a.article.createdAt)
                    }}</span
                  ><span>•</span
                  ><span class="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400 font-medium"
                    ><Icon name="mdi:account-outline" class="w-4 h-4" />{{ a.article.user.username }}</span
                  ><span>•</span
                  ><span class="inline-flex items-center gap-1"
                    ><Icon
                      name="mdi:eye"
                      class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition"
                    />{{ a.article.views }} {{ $t('stats.totalViews.title') }}</span
                  ><span>•</span
                  ><span class="inline-flex items-center gap-1 group-hover:text-red-500 transition"
                    ><Icon name="mdi:heart" class="w-4 h-4 text-gray-400 group-hover:scale-110 transition" />{{
                      a.article.likes
                    }}
                    {{ $t('profile.likes') }}</span
                  >
                </div>
              </div>
            </div></NuxtLink
          >
        </div>
        <Pagination :page :totalPages="totalPages" :nextPage="nextPage" :prevPage="prevPage" />
      </div>
      <p v-else class="text-gray-500 dark:text-gray-400 italic text-center py-8 text-lg">
        {{ $t('articles.noResults.message') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Article as _Article } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import { formatDate } from '~~/shared/utils'

const route = useRoute()
const auth = useAuth().data
const localePath = useLocalePath()

const tagSlug = computed(() =>
  slugify(decodeURIComponent(route.params.slug as string).trim(), { lower: true, strict: true }),
)

const clientSite = await useClientSite()
if (!clientSite?.id) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

const search = shallowRef('')
const sort = shallowRef('createdAt:desc')
const page = shallowRef(1)
const perPage = 20

const query = computed(() => ({
  page: page.value,
  limit: perPage,
  ...(search.value ? { search: search.value } : {}),
  sort: sort.value,
  site: clientSite.name,
}))

const {
  data: tag,
  pending,
  refresh,
} = await useFetch(`/api/tags/slug/${tagSlug.value}`, {
  query,
  default: () => ({ id: '', name: $t('articles.tags.noTagsFound'), slug: '', articles: [], hasMore: false }),
  watch: false,
  lazy: true,
})

watchEffect(() => {
  if (page.value > 1 && !tag.value.hasMore) page.value = 1
})

const tagName = computed(() => tag.value.name)
const paginated = computed(() =>
  tag.value.articles.map((a: any) => ({
    ...a,
    article: { ...a.article, likes: a.article._count?.reactions ?? 0 },
  })),
)
const totalPages = computed(() => 1)
const hasMore = computed(() => tag.value.hasMore)
const nextPage = () => hasMore.value && page.value++
const prevPage = () => page.value > 1 && page.value--

const sortItems = computed(() => [
  { value: 'createdAt:desc', label: $t('common.sortOptions.newest') },
  { value: 'createdAt:asc', label: $t('common.sortOptions.oldest') },
  { value: 'title:asc', label: $t('common.labels.title') + ' A-Z' },
  { value: 'title:desc', label: $t('common.labels.title') + ' Z-A' },
])

const debouncedRefresh = useDebounceFn(() => {
  page.value = 1
  refresh()
}, 300)

watch([search, sort], debouncedRefresh)

useSeoMeta({
  title: () => `Články s tagem: ${tagName.value}`,
  description: () => `Seznam článků označených tagem ${tagName.value}.`,
  ogTitle: () => `Články s tagem: ${tagName.value}`,
  ogDescription: () => `Seznam článků označených tagem ${tagName.value}.`,
  twitterCard: 'summary',
})
</script>
