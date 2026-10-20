<template>
  <div class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="min-w-0 w-full">
      <Back />
      <header class="mt-6 flex flex-col gap-5 border-b border-default pb-6 sm:flex-row sm:items-start">
        <UserPicture :url="author.avatarUrl" :name="authorName" size="xl" />
        <div class="min-w-0 flex-1 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="min-w-0 break-words text-3xl font-bold text-highlighted">{{ authorName }}</h1>
            <UButton
              v-if="auth?.user?.id !== author.id"
              color="neutral"
              :variant="isFollowing ? 'soft' : 'solid'"
              :icon="isFollowing ? 'mdi:account-check' : 'mdi:account-plus'"
              :loading="followPending"
              @click="toggleFollow"
              >{{ isFollowing ? $t('profile.unfollow') : $t('profile.follow') }}</UButton
            >
          </div>
          <p v-if="author.bio" class="max-w-2xl text-sm leading-6 text-muted">{{ author.bio }}</p>
          <dl class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <div>
              <dt class="sr-only">{{ $t('stats.articleCount') }}</dt>
              <dd>
                <strong class="text-highlighted">{{ author.articleCount }}</strong> {{ $t('stats.articleCount') }}
              </dd>
            </div>
            <div>
              <dt class="sr-only">{{ $t('profile.followers') }}</dt>
              <dd>
                <strong class="text-highlighted">{{ author.followerCount }}</strong> {{ $t('profile.followers') }}
              </dd>
            </div>
            <div>
              <dt class="sr-only">{{ $t('profile.following') }}</dt>
              <dd>
                <strong class="text-highlighted">{{ author.followingCount }}</strong> {{ $t('profile.following') }}
              </dd>
            </div>
            <div>
              <dt class="sr-only">{{ $t('common.user.joined', [formatDate(author.joinedAt, locale)]) }}</dt>
              <dd>{{ $t('common.user.joined', [formatDate(author.joinedAt, locale)]) }}</dd>
            </div>
          </dl>
        </div>
      </header>
      <div class="min-w-0 w-full pt-4 pb-8">
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
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData, PublicAuthorSummary } from '~~/shared/types/article'

import { formatDate } from '~~/shared/utils'

type AuthorArticlesResponse = PublicAuthorSummary & {
  articles: Array<{ articleId: string; article: ArticleCardData }>
  hasMore: boolean
  total: number
}

definePageMeta({ shell: 'publication' })

const route = useRoute()
const { data: auth } = useAuth()
const toast = useToast()
const { locale } = useI18n()
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
const authorApiPath = `/api/articles/${encodeURIComponent(username.value)}/by-author`

const {
  data: author,
  pending,
  refresh,
  error,
} = await useFetch<AuthorArticlesResponse>(authorApiPath, {
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
    joinedAt: '',
    roleLabel: '',
    articleCount: 0,
    followerCount: 0,
    followingCount: 0,
    commentCount: 0,
    totalArticleViews: 0,
    totalArticleLikes: 0,
  }),
  watch: false,
})

if (error.value || (!pending.value && !author.value?.id)) {
  throw createError({ statusCode: 404, message: 'Author not found', fatal: true })
}

const authorName = computed(() => author.value.username || '')
const articles = computed(() => author.value.articles.map(({ article }) => article))
const { data: following, refresh: refreshFollowing } = await useFetch<Array<{ id: string }>>('/api/follows/followed', {
  immediate: Boolean(auth.value?.user),
  default: () => [],
})
const isFollowing = computed(() => following.value.some((user) => user.id === author.value.id))
const followPending = shallowRef(false)
const toggleFollow = async () => {
  if (!auth.value?.user) return navigateTo(localePath({ name: 'autorizace' }))
  if (followPending.value || auth.value.user.id === author.value.id) return
  followPending.value = true
  try {
    const result = isFollowing.value
      ? await $fetch<{ followerCount: number }>(`/api/follows/${author.value.id}`, { method: 'DELETE' })
      : await $fetch<{ followerCount: number }>('/api/follows', {
          method: 'POST',
          body: { followedId: author.value.id },
        })
    author.value.followerCount = result.followerCount
    await refreshFollowing()
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, $t('profile.messages.followFailed')) })
  } finally {
    followPending.value = false
  }
}

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
