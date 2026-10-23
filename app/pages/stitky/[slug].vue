<template>
  <div class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="min-w-0 w-full">
      <Back />
      <UPageHeader :title="$t('articles.tagsArticles', { name: tagName })" :ui="{ root: 'pt-2' }">
        <template #headline>
          <UBadge color="primary" variant="soft" icon="mdi:tag-outline">{{ tagName }}</UBadge>
        </template>
      </UPageHeader>
      <div class="min-w-0 w-full pt-4 pb-8">
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
  </div>
</template>

<script setup lang="ts">
import type { Language } from '~~/shared/utils/language'
import type { ArticleCardData } from '~~/shared/types/article'

import { useArticleFeed } from '~/composables/useArticleFeed'
import { createAsyncDataDefault } from '~/utils/asyncDataDefaults'

definePageMeta({ shell: 'publication' })

const route = useRoute()
const { t } = useI18n()
const canonicalOrigin = useCanonicalOrigin()
const localePath = useLocalePath()

const tagSlug = computed(() => String(route.params.slug ?? '').trim())

const clientSite = await useClientSite()
if (!clientSite?.id) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound'), fatal: true })

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
const requestFetch = useRequestFetch()

const {
  data: tag,
  pending,
  refresh,
  error,
} = await useArticleFeed(
  `tag-${tagSlug.value}`,
  (signal) =>
    requestFetch(`/api/tags/slug/${encodeURIComponent(tagSlug.value)}`, {
      query: query.value,
      signal,
    }),
  {
    default: createAsyncDataDefault({ id: '', name: '', slug: '', articles: [], hasMore: false, total: 0 }),
  },
)

if (error.value || (!pending.value && !tag.value?.id)) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    message: t('common.errors.tagNotFound'),
    fatal: true,
  })
}

if (tag.value.slug && tag.value.slug !== tagSlug.value) {
  await navigateTo(localePath({ name: 'stitky-slug', params: { slug: tag.value.slug }, query: route.query }), {
    redirectCode: 301,
    replace: true,
  })
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
      itemListElement: tag.value.articles.map((item: { slug: string; language?: Language }, index: number) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${canonicalOrigin}${localePath({ name: 'clanky-slug', params: { slug: item.slug } }, item.language)}`,
      })),
    }),
  ])
}
</script>
