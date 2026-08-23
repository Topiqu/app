<template>
  <div class="mx-auto max-w-4xl px-4">
    <UPage>
      <Back />
      <UPageHeader :title="`${$t('articles.tagsArticles')} ${tagName}`">
        <template #headline>
          <UBadge color="primary" variant="soft" icon="i-mdi-tag-outline">{{ tagName }}</UBadge>
        </template>
      </UPageHeader>
      <UPageBody>
        <ArticleCollection
          v-model:search="search"
          v-model:sort="sort"
          v-model:page="page"
          :articles
          :pending
          :hasMore="tag.hasMore"
        />
      </UPageBody>
    </UPage>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

import slugify from 'slugify'

definePageMeta({ shell: 'publication' })

const route = useRoute()
const canonicalOrigin = useCanonicalOrigin()
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
  default: () => ({ id: '', name: '', slug: '', articles: [], hasMore: false, total: 0 }),
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
  return `${canonicalOrigin}${path}`
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

useHead({ link: [{ rel: 'canonical', href: canonicalUrl }] })

if (hasSeoPlan.value && tag.value?.id) {
  useSchemaOrg([
    defineWebPage({
      '@type': 'CollectionPage',
      name: tagName.value,
      description: $t('seo.tags.description', { name: tagName.value }),
    }),
    defineItemList({
      itemListElement: tag.value.articles.map((item: { slug: string }, index: number) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${canonicalOrigin}${localePath({ name: 'clanky-slug', params: { slug: item.slug } })}`,
      })),
    }),
  ])
}
</script>
