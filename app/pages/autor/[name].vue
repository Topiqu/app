<template>
  <div class="min-h-screen bg-gradient-to-br">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <Back />
      <div class="text-center">
        <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {{ $t('articles.authorsArticles') }}
          <span class="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {{ authorName }}
          </span>
        </h1>
        <div class="flex flex-col items-center mt-4 gap-2">
          <NuxtImg
            v-if="author.avatarUrl"
            :src="author.avatarUrl"
            :alt="$t('common.avatar.alt.author', [authorName])"
            class="w-16 h-16 rounded-full border border-gray-200 dark:border-neutral-700 object-cover"
          />
          <p v-if="author.bio" class="text-gray-600 dark:text-gray-400 max-w-lg">
            {{ author.bio }}
          </p>
        </div>
      </div>

      <ArticleCollection
        v-model:search="search"
        v-model:sort="sort"
        v-model:page="page"
        :articles
        :pending
        :hasMore="author.hasMore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

const route = useRoute()
const reqUrl = useRequestURL()
const localePath = useLocalePath()

const username = computed(() => decodeURIComponent(route.params.name as string).trim())
const search = shallowRef('')
const sort = shallowRef('createdAt:desc')
const page = shallowRef(1)
const perPage = 20

const query = computed(() => ({
  page: page.value,
  limit: perPage,
  ...(search.value ? { search: search.value } : {}),
  sort: sort.value,
}))

const clientSite = await useClientSite()

const {
  data: author,
  pending,
  refresh,
  error,
} = await useFetch(`/api/articles/${username.value}/by-author`, {
  key: `author-${username.value}`,
  query,
  default: () => ({
    id: '',
    username: '',
    articles: [],
    hasMore: false,
    bio: '',
    avatarUrl: '',
  }),
  watch: false,
})

if (error.value || (!pending.value && !author.value?.id)) {
  throw createError({ statusCode: 404, message: 'Author not found', fatal: true })
}

const authorName = computed(() => author.value.username || '')
const articles = computed(() => author.value.articles.map((a) => (a as { article: ArticleCardData }).article))

const debouncedRefresh = useDebounceFn(() => refresh(), 300)
watch([search, sort], () => {
  page.value = 1
  debouncedRefresh()
})
watch(page, debouncedRefresh)

const canonicalUrl = computed(() => {
  const path = localePath({ name: 'autor-name', params: { name: username.value } })
  return `${reqUrl.protocol}//${reqUrl.host}${path}`
})

const hasSeoPlan = computed(() => clientSite?.plan !== 'BASIC')

useSeoMeta({
  title: () => $t('seo.author.title', { name: authorName.value }),
  description: () =>
    hasSeoPlan.value ? author.value.bio || $t('seo.author.description', { name: authorName.value }) : undefined,
  ogTitle: () => (hasSeoPlan.value ? $t('seo.author.title', { name: authorName.value }) : undefined),
  ogDescription: () =>
    hasSeoPlan.value ? author.value.bio || $t('seo.author.description', { name: authorName.value }) : undefined,
  ogImage: () => (hasSeoPlan.value ? author.value.avatarUrl || '/default-user.png' : undefined),
  ogUrl: () => (hasSeoPlan.value ? canonicalUrl.value : undefined),
  twitterCard: () => (hasSeoPlan.value ? 'summary' : undefined),
  robots: () => (hasSeoPlan.value && !search.value ? 'index, follow' : 'noindex, follow'),
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        hasSeoPlan.value && author.value?.id
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ProfilePage',
              mainEntity: {
                '@type': 'Person',
                name: authorName.value,
                description: author.value.bio || $t('seo.author.description', { name: authorName.value }),
                image: author.value.avatarUrl,
                url: canonicalUrl.value,
              },
            })
          : '',
      ),
    },
  ],
})
</script>
