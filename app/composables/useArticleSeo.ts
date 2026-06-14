import type { MaybeRefOrGetter } from 'vue'

export function useArticleSeo(
  data: MaybeRefOrGetter<any>,
  clientSite: MaybeRefOrGetter<any>,
  canonicalUrl: MaybeRefOrGetter<string>,
  alternates: MaybeRefOrGetter<{ hreflang: string; href: string }[]> = [],
) {
  const resolvedData = computed(() => toValue(data))
  const resolvedClientSite = computed(() => toValue(clientSite))
  const resolvedCanonicalUrl = computed(() => toValue(canonicalUrl))
  const resolvedAlternates = computed(() => toValue(alternates) ?? [])

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

  useHead({
    link: () => [
      { rel: 'canonical', href: resolvedCanonicalUrl.value },
      ...resolvedAlternates.value.map((alt) => ({ rel: 'alternate', hreflang: alt.hreflang, href: alt.href })),
      ...(resolvedAlternates.value.length
        ? [{ rel: 'alternate', hreflang: 'x-default', href: resolvedAlternates.value[0]!.href }]
        : []),
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
