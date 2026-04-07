import type { MaybeRefOrGetter } from 'vue'

export function useArticleSeo(
  data: MaybeRefOrGetter<any>,
  clientSite: MaybeRefOrGetter<any>,
  canonicalUrl: MaybeRefOrGetter<string>,
) {
  const { t } = useI18n()
  const resolvedData = computed(() => toValue(data))
  const resolvedClientSite = computed(() => toValue(clientSite))
  const resolvedCanonicalUrl = computed(() => toValue(canonicalUrl))

  const hasSeoPlan = computed(() => resolvedClientSite.value?.plan !== 'BASIC')

  const articleDescription = computed(
    () =>
      resolvedData.value?.excerpt?.slice(0, 160) ||
      resolvedData.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) ||
      '',
  )

  useSeoMeta({
    title: () => resolvedData.value?.title || 'Article',
    description: () => (hasSeoPlan.value ? articleDescription.value : undefined),
    ogTitle: () => (hasSeoPlan.value ? resolvedData.value?.title || 'Article' : undefined),
    ogDescription: () => (hasSeoPlan.value ? articleDescription.value : undefined),
    ogUrl: () => (hasSeoPlan.value ? resolvedCanonicalUrl.value : undefined),
    ogType: () => (hasSeoPlan.value ? 'article' : undefined),
    ogImageWidth: 1200,
    ogImageHeight: 600,
    twitterImageWidth: 1200,
    twitterImageHeight: 600,
    twitterCard: 'summary_large_image',
    twitterTitle: () => (hasSeoPlan.value ? resolvedData.value?.title || 'Article' : undefined),
    twitterDescription: () => (hasSeoPlan.value ? articleDescription.value : undefined),
  })

  const ogDescription = computed(() => {
    const text = articleDescription.value || ''
    return (
      text
        .slice(0, 100)
        .replace(/[\n\r]+/g, ' ')
        .trim() + '...'
    )
  })

  watchEffect(() => {
    if (!resolvedData.value) return
    const site = resolvedClientSite.value
    const article = resolvedData.value

    if (hasSeoPlan.value) {
      defineOgImageComponent('TopiquArticle', {
        title: article.title,
        description: ogDescription.value,
        siteName: site?.name || 'Blog',
        siteLogo: site?.logoUrl || undefined,
        authorName: article.user?.username,
        authorImage: article.user?.avatarUrl || undefined,
        readingTime: t('articles.readingTime', [article.readingTime]),
        backgroundImage: article.imageUrl || undefined,
        isPremium: true,
      })
    } else {
      defineOgImageComponent('TopiquArticle', {
        title: article.title,
        siteName: 'Topiqu',
        authorName: article.user?.username,
        backgroundImage: undefined,
        isPremium: false,
      })
    }
  })

  useHead({
    link: [
      {
        rel: 'canonical',
        href: resolvedCanonicalUrl,
      },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: computed(() =>
          hasSeoPlan.value && resolvedData.value
            ? JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: resolvedData.value?.title,
                description: articleDescription.value,
                mainEntityOfPage: {
                  '@type': 'WebPage',
                  '@id': resolvedCanonicalUrl.value,
                },
                image: resolvedData.value?.imageUrl ? [resolvedData.value.imageUrl] : [],
                datePublished: resolvedData.value?.createdAt,
                dateModified: resolvedData.value?.updatedAt,
                author: {
                  '@type': 'Person',
                  name: resolvedData.value?.user?.username || resolvedClientSite.value?.name,
                },
                publisher: {
                  '@type': 'Organization',
                  name: resolvedClientSite.value?.name,
                  logo: {
                    '@type': 'ImageObject',
                    url: resolvedClientSite.value?.logoUrl,
                  },
                },
              })
            : '',
        ),
      },
    ],
  })
}
