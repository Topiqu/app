<template>
  <div class="mx-auto max-w-4xl px-4">
    <UPage>
      <Back />
      <UPageHeader :title="`${$t('articles.authorsArticles')} ${authorName}`">
        <div class="flex items-center gap-4">
          <AppMedia
            :src="author.avatarUrl"
            :alt="$t('common.avatar.alt.author', [authorName])"
            :fallbackText="authorName"
            aspectRatio="1 / 1"
            sizes="64px"
            containerClass="size-16 shrink-0 rounded-full"
          />
          <div class="min-w-0">
            <p class="font-semibold text-highlighted">{{ authorName }}</p>
            <p v-if="author.bio" class="text-sm text-muted">{{ author.bio }}</p>
          </div>
        </div>
      </UPageHeader>
      <UPageBody>
        <ArticleCollection
          v-model:search="search"
          v-model:sort="sort"
          v-model:page="page"
          :articles
          :pending
          :hasMore="author.hasMore"
        />
      </UPageBody>
    </UPage>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

definePageMeta({ shell: 'publication' })

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
