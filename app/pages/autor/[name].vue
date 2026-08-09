<template>
  <div class="min-h-screen bg-gradient-to-br">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <Back />
      <header class="flex flex-col items-center gap-4 text-center">
        <UserPicture
          :url="author.avatarUrl"
          :name="authorName"
          size="xl"
          class="ring-4 ring-white dark:ring-neutral-900 shadow-lg"
        />
        <div class="flex flex-col items-center gap-1">
          <h1
            class="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent"
          >
            {{ authorName }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('articles.articlesCount', author.total, { count: author.total }) }}
          </p>
        </div>
        <p v-if="author.bio" class="text-gray-600 dark:text-gray-400 max-w-lg text-pretty">
          {{ author.bio }}
        </p>
      </header>

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
const canonicalOrigin = useCanonicalOrigin()
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
    total: 0,
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
  return `${canonicalOrigin}${path}`
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

useHead({ link: [{ rel: 'canonical', href: canonicalUrl }] })

// Same `@id` the article's `author` points at, so the two resolve to one entity.
if (hasSeoPlan.value) {
  useSchemaOrg([
    definePerson({
      '@id': `${canonicalUrl.value}#author`,
      name: authorName.value,
      url: canonicalUrl.value,
      image: author.value.avatarUrl || undefined,
      description: author.value.bio || $t('seo.author.description', { name: authorName.value }),
    }),
    defineWebPage({ '@type': 'ProfilePage', mainEntity: { '@id': `${canonicalUrl.value}#author` } }),
  ])
}
</script>
