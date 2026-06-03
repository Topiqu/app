<template>
  <div class="min-h-screen bg-gradient-to-br">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <Back />
      <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-center">
        {{ $t('articles.tagsArticles') }}
        <span class="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">{{ tagName }}</span>
      </h1>
      <ArticleCollection
        v-model:search="search"
        v-model:sort="sort"
        v-model:page="page"
        :articles
        :pending
        :hasMore="tag.hasMore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

import slugify from 'slugify'

const route = useRoute()
const reqUrl = useRequestURL()
const localePath = useLocalePath()

const tagSlug = computed(() =>
  slugify(decodeURIComponent(route.params.slug as string).trim(), { lower: true, strict: true }),
)

const clientSite = await useClientSite()
if (!clientSite?.id) throw createError({ statusCode: 404, message: 'Blog not found', fatal: true })

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
  error,
} = await useFetch(`/api/tags/slug/${tagSlug.value}`, {
  key: `tag-${tagSlug.value}`,
  query,
  default: () => ({ id: '', name: '', slug: '', articles: [], hasMore: false }),
  watch: false,
})

if (error.value || (!pending.value && !tag.value?.id)) {
  throw createError({ statusCode: 404, message: 'Tag not found', fatal: true })
}

const tagName = computed(() => tag.value.name)
const articles = computed(() => tag.value.articles as ArticleCardData[])

const debouncedRefresh = useDebounceFn(() => refresh(), 300)
watch([search, sort], () => {
  page.value = 1
  debouncedRefresh()
})
watch(page, debouncedRefresh)

const canonicalUrl = computed(() => {
  const path = localePath({ name: 'stitky-slug', params: { slug: tagSlug.value } })
  return `${reqUrl.protocol}//${reqUrl.host}${path}`
})

const hasSeoPlan = computed(() => clientSite?.plan !== 'BASIC')

useSeoMeta({
  title: () => $t('seo.tags.title', { name: tagName.value }),
  description: () => (hasSeoPlan.value ? $t('seo.tags.description', { name: tagName.value }) : undefined),
  ogTitle: () => (hasSeoPlan.value ? $t('seo.tags.title', { name: tagName.value }) : undefined),
  ogDescription: () => (hasSeoPlan.value ? $t('seo.tags.description', { name: tagName.value }) : undefined),
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
        hasSeoPlan.value && tag.value?.id
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: tagName.value,
              description: $t('seo.tags.description', { name: tagName.value }),
              url: canonicalUrl.value,
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: tag.value.articles.map((item: { slug: string }, index: number) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  url: `${reqUrl.protocol}//${reqUrl.host}${localePath({ name: 'clanky-slug', params: { slug: item.slug } })}`,
                })),
              },
            })
          : '',
      ),
    },
  ],
})
</script>
