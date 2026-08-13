import type { MaybeRefOrGetter } from 'vue'

import { hasSeoPlan } from '~~/shared/utils/seo'
import { readFaq } from '~~/shared/utils/articleFaq'

type ArticleAuthor = { id: string; username: string | null; avatarUrl: string | null; bio: string | null }

type SeoArticle = {
  title?: string | null
  excerpt?: string | null
  content?: string | null
  imageUrl?: string | null
  language?: string | null
  publishedAt?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  readingTime?: number | null
  totalWords?: number | null
  sources?: string[] | null
  faq?: unknown
  tags?: { tag: { name: string } }[] | null
  user?: ArticleAuthor | null
}

/** Schema.org dates are strings; the payload carries ISO already, a fresh fetch carries a Date. */
const isoDate = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString() : undefined)

export function useArticleSeo(
  data: MaybeRefOrGetter<SeoArticle | null | undefined>,
  clientSite: MaybeRefOrGetter<{ name?: string; plan?: string; logoUrl?: string | null } | null | undefined>,
  canonicalUrl: MaybeRefOrGetter<string>,
  alternates: MaybeRefOrGetter<{ hreflang: string; href: string }[]> = [],
) {
  const localePath = useLocalePath()
  const canonicalOrigin = useCanonicalOrigin()

  const article = computed(() => toValue(data))
  const site = computed(() => toValue(clientSite))
  const canonical = computed(() => toValue(canonicalUrl))
  const resolvedAlternates = computed(() => toValue(alternates) ?? [])

  const seoEnabled = computed(() => hasSeoPlan(site.value?.plan))

  const description = computed(
    () => article.value?.excerpt?.slice(0, 160) || article.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) || '',
  )

  const authorName = computed(() => article.value?.user?.username || site.value?.name || '')
  const authorUrl = computed(() =>
    article.value?.user?.username
      ? `${canonicalOrigin}${localePath({ name: 'autor-name', params: { name: article.value.user.username } })}`
      : '',
  )

  const tagNames = computed(() => article.value?.tags?.map((entry) => entry.tag.name) ?? [])

  const faq = computed(() => readFaq(article.value?.faq))

  useSeoMeta({
    title: () => article.value?.title || 'Article',
    description: () => (seoEnabled.value ? description.value : undefined),
    ogTitle: () => (seoEnabled.value ? article.value?.title || 'Article' : undefined),
    ogDescription: () => (seoEnabled.value ? description.value : undefined),
    ogUrl: () => (seoEnabled.value ? canonical.value : undefined),
    ogType: () => (seoEnabled.value ? 'article' : undefined),
    ogImageWidth: 1200,
    ogImageHeight: 600,
    twitterImageWidth: 1200,
    twitterImageHeight: 600,
    twitterCard: 'summary_large_image',
    twitterTitle: () => (seoEnabled.value ? article.value?.title || 'Article' : undefined),
    twitterDescription: () => (seoEnabled.value ? description.value : undefined),
  })

  useHead({
    link: () => [
      { rel: 'canonical', href: canonical.value },
      ...resolvedAlternates.value.map((alt) => ({ rel: 'alternate', hreflang: alt.hreflang, href: alt.href })),
      // Index 0 is the source language — the API builds `alternates` as `[primary, …translations]`.
      ...(resolvedAlternates.value.length
        ? [{ rel: 'alternate', hreflang: 'x-default', href: resolvedAlternates.value[0]!.href }]
        : []),
    ],
  })

  if (!seoEnabled.value) return

  // Links into the Organization/WebSite from `app.vue`; the module resolves the edges itself.
  useSchemaOrg([
    defineArticle({
      '@type': 'BlogPosting',
      headline: () => article.value?.title || '',
      description: () => description.value,
      image: () => article.value?.imageUrl || undefined,
      // `createdAt` is when the draft was opened, not when it went live.
      datePublished: () => isoDate(article.value?.publishedAt ?? article.value?.createdAt),
      dateModified: () => isoDate(article.value?.updatedAt),
      inLanguage: () => article.value?.language || undefined,
      wordCount: () => article.value?.totalWords || undefined,
      timeRequired: () => (article.value?.readingTime ? `PT${article.value.readingTime}M` : undefined),
      // Plain values — these take a resolvable array, not a getter, and the caller awaits first.
      articleSection: tagNames.value,
      keywords: tagNames.value,
      // The research URLs the body was grounded in; omitted rather than emitted empty.
      citation: () =>
        article.value?.sources?.length ? article.value.sources.map((url) => ({ '@type': 'WebPage', url })) : undefined,
      author: () =>
        authorName.value
          ? { '@type': 'Person', '@id': `${authorUrl.value}#author`, name: authorName.value }
          : undefined,
    }),
    // For LLM extraction, not Google — FAQ rich results were fully sunset in May 2026. Emitted
    // only when the article carries real questions; the generator returns none otherwise.
    ...(faq.value.length
      ? faq.value.map((entry) =>
          defineQuestion({
            name: entry.question,
            acceptedAnswer: { '@type': 'Answer', text: entry.answer },
          }),
        )
      : []),
    ...(authorUrl.value
      ? [
          definePerson({
            '@id': `${authorUrl.value}#author`,
            name: authorName.value,
            url: authorUrl.value,
            image: article.value?.user?.avatarUrl || undefined,
            description: article.value?.user?.bio || undefined,
          }),
        ]
      : []),
  ])
}
