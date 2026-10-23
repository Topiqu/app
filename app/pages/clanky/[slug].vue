<template>
  <div v-if="data && article" class="px-4 py-8 sm:px-6 lg:px-8">
    <ArticleView
      :article
      :aiDisclosure="showsAiDisclosure ? data.aiInvolvement : null"
      :discloseAi="clientSite?.discloseAiContent ?? false"
      :ad="bodyAd"
      :follow="{
        count: data.followerCount || 0,
        following: isFollowing,
        visible: !!session?.user && session.user.id !== data.user.id,
        pending: followPending || followStatusPending,
        error: !!followStatusError,
      }"
      @follow="toggleFollow"
      @share="share"
    >
      <template #top>
        <nav v-if="breadcrumbs?.length" :aria-label="$t('common.breadcrumbs')" class="w-full">
          <ol class="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden text-sm text-muted">
            <li
              v-for="(item, index) in breadcrumbs"
              :key="index"
              class="flex min-w-0 items-center gap-2"
              :class="index === breadcrumbs.length - 1 ? 'flex-1' : 'shrink-0'"
            >
              <UIcon v-if="index > 0" name="mdi:chevron-right" size="16" />
              <ULink v-if="index < breadcrumbs.length - 1" :to="item.to">
                {{ item.label }}
              </ULink>
              <UTooltip v-else :text="item.label">
                <span class="block min-w-0 truncate font-semibold text-highlighted">{{ item.label }}</span>
              </UTooltip>
            </li>
          </ol>
        </nav>
      </template>

      <!-- Only renders with a real published translation, so a language here never falls back. -->
      <template v-if="hasTranslations" #languages>
        <ArticleLanguageLinks :links="alternates" :current="data.language" />
      </template>

      <template #actions>
        <ArticleActionsBar
          :article="data"
          :isAdmin="canManageArticle(session?.user, data)"
          :onStatusUpdate="debouncedSetStatus"
          @toggleComments="toggleComments"
          @refresh="refresh"
        >
          <template #sharing>
            <div class="flex flex-wrap items-center gap-1">
              <UButton
                :color="articleLiked ? 'error' : 'neutral'"
                :variant="articleLiked ? 'soft' : 'ghost'"
                icon="mdi:heart"
                square
                :aria-label="$t('common.actions.like')"
                :loading="articleReactionPending"
                @click="toggleArticleLike"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="mdi:link-variant"
                square
                :aria-label="$t('common.actions.copyLink')"
                @click="copyLink(fullUrl)"
              />
              <UButton
                :to="`https://x.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
                target="_blank"
                color="neutral"
                variant="ghost"
                icon="mdi:twitter"
                square
                aria-label="X"
                @click="share('TWITTER')"
              />
              <UButton
                :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
                target="_blank"
                color="neutral"
                variant="ghost"
                icon="mdi:linkedin"
                square
                aria-label="LinkedIn"
                @click="share('LINKEDIN')"
              />
            </div>
          </template>
        </ArticleActionsBar>
      </template>

      <template #footer>
        <div
          class="mt-8 flex flex-col items-start justify-between gap-4 border-t border-default pt-8 sm:flex-row sm:items-center"
        >
          <div class="flex shrink-0 items-center">
            <ClientSocials :clientSiteId="data.clientSiteId" class="flex gap-2 text-muted" />
          </div>
          <LazyArticleFeedback :articleId="data.id" class="w-full sm:max-w-xl" />
        </div>
        <WidgetSlot name="ARTICLE_END" class="mt-8" />
      </template>

      <template #related>
        <LazyArticleRelated hydrateOnVisible :articles="relatedArticles ?? []" :pending="pending" />
      </template>

      <template #comments>
        <LazyCommentSection
          :articleId="data.id"
          :commCount="data.commentCount || 0"
          :allowComments="data.commentingEnabled"
          :allowGifs="data.commentGifsEnabled"
        />
      </template>

      <template v-if="sidebarAd" #sidebar>
        <!-- This independent rail sits to the right of the TOC on wide screens. -->
        <ClientOnly>
          <AdSenseSlot
            v-if="sidebarAd === 'adsense' && isAdDesktop"
            :key="`article-sidebar-adsense-${data.id}`"
            :adSlot="sidebarAdsenseSlot"
            format="vertical"
            :fullWidthResponsive="false"
            class="min-h-[618px]"
          />
          <AdSlot
            v-else-if="sidebarAd === 'gam' && isAdDesktop"
            :key="`article-sidebar-${data.id}`"
            adUnitPath="/article/sidebar"
            slotId="article-sidebar-ad"
            :sizes="[
              [160, 600],
              [120, 600],
            ]"
            :sizeMapping="articleSidebarMapping"
            :targeting="{ article_id: data.id, placement: 'sidebar' }"
            width="160px"
            height="600px"
            showLabel
          />
        </ClientOnly>
      </template>
    </ArticleView>
  </div>
  <Status v-else-if="status" :status="status" :message="status === 'error' ? `${error?.message}` : ''" />
</template>

<script setup lang="ts">
definePageMeta({ shell: 'publication' })

const route = useRoute()
const preview = useWidgetPagePreview()
const toast = useToast()
const localePath = useLocalePath()
const canonicalOrigin = useCanonicalOrigin()

const { data: session } = useAuth()
const clientSite = await useClientSite()
const { marketingGranted } = useConsent(() => clientSite)
const adsense = useRuntimeConfig().public
const sidebarAdsenseSlot = String(adsense.adsenseArticleSidebarSlot || '')
const adsenseStatus = useAdSenseStatus()
const adFor = (adsenseSlot: string) => {
  if (preview.active.value) return null
  const provider = adProviderFor(clientSite, { marketing: marketingGranted.value, adsenseSlot })
  return provider === 'adsense' && adsenseStatus.value === 'error' ? null : provider
}
const sidebarAd = computed(() => adFor(sidebarAdsenseSlot))
const bodyAd = computed(() => adFor(String(adsense.adsenseArticleBodySlot || '')))
const isAdDesktop = useMediaQuery('(min-width: 1280px)')
const articleSidebarMapping: GamSizeMapping[] = [
  { viewport: [1280, 0], sizes: [[160, 600]] },
  { viewport: [0, 0], sizes: [] },
]
const slug = computed(() => route.params.slug as string)

const { locale } = useI18n()

// `deep` is false by default in Nuxt 4, i.e. `data` is a shallowRef. The engagement counters
// (likes, shared, followerCount) are written back into this payload after each action, and a
// shallow ref does not track those nested writes — `ArticleActionsBar` receives the same object
// identity, so `hasPropsChanged` bails and the counts only appeared after a page refresh.
const { data, refresh, error, status } = await useFetch(`/api/articles/${slug.value}` as `/api/articles/:id`, {
  query: { clientSiteId: clientSite?.id, locale: locale.value },
  deep: true,
})

const movedTo = (error.value?.data as { data?: { movedTo?: string } } | undefined)?.data?.movedTo
if (movedTo)
  await navigateTo(
    localePath({
      name: 'clanky-slug',
      params: { slug: movedTo },
      query: preview.active.value ? route.query : undefined,
    }),
    { redirectCode: 301, replace: true },
  )

// Landing on this locale with another language's slug (browser-language detection, an old link,
// a hand-edited URL) silently renders the source body. Send it to the real translation instead.
// Deliberately 302, not 301: a translation can be unpublished or discarded, and a cached
// permanent redirect would then pin visitors to a URL that 404s.
const redirectSlug = localeRedirectSlug(locale.value, data.value?.language, data.value?.alternates ?? [])
if (redirectSlug) {
  await navigateTo(
    localePath({
      name: 'clanky-slug',
      params: { slug: redirectSlug },
      query: preview.active.value ? route.query : undefined,
    }),
    {
      redirectCode: 302,
      replace: true,
    },
  )
}

const {
  isFollowing: followedStatus,
  known: followStatusKnown,
  pending: followStatusPending,
  error: followStatusError,
  refresh: refreshFollows,
} = useFollowStatus(() => data.value?.user.id)

const requestFetch = useRequestFetch()
const { data: relatedArticles, pending } = await useArticleFeed(
  computed(() => `article-related:${slug.value}:${data.value?.clientSiteId ?? ''}:${data.value?.language ?? ''}`),
  (signal) =>
    requestFetch(`/api/articles/${slug.value}/related`, {
      signal,
      query: {
        limit: 3,
        clientSiteId: data.value?.clientSiteId,
        locale: data.value?.language,
      },
    }),
  {
    lazy: true,
    default: emptyAsyncDataList,
    // Without the article there is no clientSiteId, and the request can only 400.
    immediate: Boolean(data.value),
  },
)

const primaryLocale = computed(() => data.value?.primaryLanguage ?? clientSite?.language ?? 'en')

// Real alternates only exist once translations are PUBLISHED (source + each translation).
const alternates = computed<{ language: Language; slug: string }[]>(() => data.value?.alternates ?? [])
const hasTranslations = computed(() => alternates.value.length >= 2)

const alternateLinks = computed(() =>
  hasTranslations.value
    ? alternates.value.map((alt) => ({
        hreflang: alt.language,
        href: `${canonicalOrigin}${localePath({ name: 'clanky-slug', params: { slug: alt.slug } }, alt.language)}`,
      }))
    : [],
)

const canonicalUrl = computed(() => {
  if (!data.value?.slug) return ''
  // With real translations, each locale self-canonicalises; otherwise collapse the
  // duplicate i18n-alias URLs onto the primary-language path (mono-lingual mitigation).
  const lang = hasTranslations.value ? (data.value.language ?? primaryLocale.value) : primaryLocale.value
  return `${canonicalOrigin}${localePath({ name: 'clanky-slug', params: { slug: data.value.slug } }, lang)}`
})

useArticleSeo(data, clientSite, canonicalUrl, alternateLinks)

const ogImageOptions = computed(() => ({
  backgroundImage: data.value?.imageUrl,
}))

defineOgImage('TopiquArticle', ogImageOptions.value)

const { trackView } = useArticleTracking(computed(() => data.value?.id))

const { share, copyLink, toggleComments, debouncedSetStatus } = useArticleActions(data, refresh)

const isFollowing = shallowRef(followedStatus.value)
watch([followStatusKnown, followedStatus], ([known, following]) => {
  if (known) isFollowing.value = following
})
const followPending = shallowRef(false)
let followSequence = 0
watch(
  [() => session.value?.user.id, () => data.value?.id, () => data.value?.user.id],
  () => {
    followSequence++
    followPending.value = false
    isFollowing.value = followStatusKnown.value && followedStatus.value
  },
  { flush: 'sync' },
)
onScopeDispose(() => followSequence++)
const optimisticStatus = useOptimisticStatus()
const toggleFollow = async () => {
  if (!session.value?.user || !data.value?.user.id)
    return toast.add({ color: 'error', title: $t('common.auth.loginPrompt') })
  if (followPending.value || session.value.user.id === data.value.user.id) return
  if (!followStatusKnown.value) {
    await refreshFollows()
    return
  }

  const viewerId = session.value.user.id
  const articleId = data.value.id
  const authorId = data.value.user.id
  const authorName = data.value.user.username
  const sequence = ++followSequence
  const current = () =>
    sequence === followSequence &&
    session.value?.user.id === viewerId &&
    data.value?.id === articleId &&
    data.value.user.id === authorId
  const previousFollowing = isFollowing.value
  const previousCount = data.value.followerCount ?? 0
  const nextFollowing = !previousFollowing
  followPending.value = true
  isFollowing.value = nextFollowing
  data.value.followerCount = Math.max(0, previousCount + (nextFollowing ? 1 : -1))
  const statusSequence = optimisticStatus.saving()

  try {
    const response = previousFollowing
      ? await $fetch<{ followerCount: number }, '/api/follows/:id'>(`/api/follows/${authorId}` as '/api/follows/:id', {
          method: 'DELETE',
        })
      : await $fetch<{ followerCount: number }, '/api/follows'>('/api/follows', {
          method: 'POST',
          body: { followedId: authorId },
        })
    optimisticStatus.saved(statusSequence)
    if (!current()) return
    if (data.value) data.value.followerCount = response.followerCount ?? 0
    toast.add({
      color: 'success',
      title: previousFollowing
        ? $t('common.messages.successGeneral')
        : $t('profile.messages.followSuccess', [authorName]),
    })
    await refreshFollows()
  } catch (e: unknown) {
    const err = e as { data?: { statusCode?: number; message?: string } }
    if (err.data?.statusCode === 409 && !previousFollowing) {
      optimisticStatus.saved(statusSequence)
      if (!current()) return
      isFollowing.value = true
      await refreshFollows()
    } else {
      optimisticStatus.reverted(statusSequence)
      if (!current()) return
      isFollowing.value = previousFollowing
      if (data.value) data.value.followerCount = previousCount
      toast.add({
        color: 'error',
        title:
          err.data?.message ||
          (isFollowing.value ? $t('profile.messages.profileUpdateError') : $t('profile.messages.followFailed')),
      })
    }
  } finally {
    if (current()) followPending.value = false
  }
}

const {
  liked: articleLiked,
  likes: articleLikes,
  isPending: articleReactionPending,
  toggle: toggleArticleReaction,
} = useArticleReaction(
  () => data.value?.id,
  () => ({ liked: Boolean(data.value?.likedByUser), likes: data.value?.likes ?? 0 }),
)
const toggleArticleLike = async () => {
  await toggleArticleReaction()
}
watch([articleLiked, articleLikes], ([liked, likes]) => {
  if (!data.value) return
  data.value.likedByUser = liked
  data.value.likes = likes
})

const article = computed(() => {
  if (!data.value) return null
  const { id, title, excerpt, imageUrl, user, series, tags, answer, keyTakeaways, blocks, faq, sources } = data.value
  return {
    id,
    title,
    excerpt,
    imageUrl,
    imageCredit: (data.value.imageCredit as CoverCredit | null) ?? null,
    author: user,
    series,
    tags: tags.map(({ tag }: { tag: { name: string } }) => ({ name: tag.name })),
    answer,
    takeaways: keyTakeaways ?? [],
    blocks,
    faq: readFaq(faq),
    sources: sources ?? [],
  }
})
const showsAiDisclosure = computed(() => !!clientSite?.discloseAiContent && data.value?.aiInvolvement !== 'NONE')
const requestUrl = useRequestURL()
const fullUrl = computed(() => new URL(route.fullPath, requestUrl.origin).href)
const breadcrumbs = computed(() => [
  { label: $t('common.actions.home'), to: localePath({ name: 'index' }) },
  {
    label: $t('articles.title'),
    to: `${localePath({ name: 'index' })}#articles`,
  },
  { label: data.value?.title || '', to: route.fullPath },
])

const articleHeader = useArticleHeaderContext()
const articleLikeBus = useArticleLikeBus()

watchEffect(() => {
  if (!data.value) return
  articleHeader.value = {
    articleId: data.value.id,
    backTo: localePath({ name: 'index' }),
    canEdit: session.value?.user?.role === 'admin' && session.value.user.id === data.value.user.id,
    liked: Boolean(data.value.likedByUser),
    title: data.value.title,
  }
})

onMounted(() => {
  if (!preview.active.value) trackView()
  articleLikeBus.on(toggleArticleLike)
})

onUnmounted(() => {
  articleLikeBus.off(toggleArticleLike)
  articleHeader.value = null
})
</script>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dark ::-webkit-scrollbar-thumb {
  background: #475569;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
