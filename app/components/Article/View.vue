<template>
  <div class="mx-auto grid max-w-[var(--topiqu-article-width)] gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
    <div class="flex min-w-0 flex-col gap-8 pt-4">
      <slot name="top" />

      <div ref="hero">
        <ArticleHeaderHero
          :title="article.title"
          :author="article.author"
          :followerCount="follow?.count ?? 0"
          :isFollowing="follow?.following ?? false"
          :showFollowButton="follow?.visible ?? false"
          :followPending="follow?.pending"
          :excerpt="article.excerpt"
          :imageUrl="article.imageUrl"
          :imageCredit="article.imageCredit"
          :series="article.series?.name ? article.series : undefined"
          @follow="emit('follow')"
        />
      </div>

      <div v-if="$slots.languages || aiDisclosure" class="flex flex-wrap items-center gap-2">
        <slot name="languages" />
        <span
          v-if="aiDisclosure"
          class="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <UIcon name="mdi:robot-outline" class="size-4" />
          {{ $t(`articles.aiDisclosure.${aiDisclosure}`) }}
        </span>
      </div>

      <div v-if="article.tags.length" class="flex flex-wrap gap-2.5">
        <NuxtLink
          v-for="tag in article.tags"
          :key="tag.name"
          :to="localePath({ name: 'stitky-slug', params: { slug: tag.name } })"
          class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UBadge color="neutral" variant="soft" size="lg" icon="mdi:tag">
            {{ tag.name }}
          </UBadge>
        </NuxtLink>
      </div>

      <ArticleSummary :answer="article.answer" :takeaways="article.takeaways" />

      <slot name="actions" />

      <article ref="content" class="article-content mx-auto w-full" :class="ARTICLE_PROSE_CLASS">
        <ArticleParsed
          v-if="article.blocks.length"
          :blocks="article.blocks"
          :articleId="article.id"
          :discloseAi="discloseAi"
        />
        <slot v-else name="empty" />
      </article>

      <ArticleFaq :entries="article.faq" />

      <ArticleSeries v-if="article.series?.name" :series="article.series" />

      <slot name="footer" />

      <LazyArticleLightbox :sourceRef="content" />

      <slot name="related" />

      <UCollapsible v-if="sources.length" v-model:open="sourcesOpen" class="mt-10 w-full">
        <UButton
          color="neutral"
          variant="soft"
          icon="mdi:book-open-page-variant"
          :trailingIcon="sourcesOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          :label="`${$t('articles.columns.sources')} (${sources.length})`"
          class="w-full"
        />
        <template #content>
          <ArticleSourceList :sources class="mt-3" />
        </template>
      </UCollapsible>

      <slot name="comments" />
    </div>

    <ArticleTOC @share="emit('share', $event)">
      <template v-if="$slots.sidebar" #sidebar>
        <slot name="sidebar" />
      </template>
    </ArticleTOC>
  </div>
</template>

<script setup lang="ts">
import type { FaqEntry } from '~~/shared/utils/articleFaq'
import type { CoverCredit } from '~~/shared/utils/imageCredit'
import type { ArticleBlock } from '~~/shared/utils/articleBlocks'
import type { SharePlatform } from '~~/generated/zenstack/models'

import { ARTICLE_PROSE_CLASS } from '~~/shared/utils/articleProse'

type SeriesLink = { slug: string; title: string; excerpt?: string | null; imageUrl?: string | null }

// The published page and the editor preview both render through this, so the two cannot drift.
// Engagement (follow, likes, comments, ads) stays in the page and comes in through slots.
const { article, discloseAi = false } = defineProps<{
  article: {
    id: string
    title: string
    excerpt?: string | null
    imageUrl?: string | null
    imageCredit?: CoverCredit | null
    author: { id?: string; username: string; avatarUrl?: string | null; bio?: string | null }
    series?: {
      name: string
      current: number
      total: number
      prev?: SeriesLink | null
      next?: SeriesLink | null
      articles?: { id: string; title: string; slug: string; seriesOrder: number; imageUrl?: string | null }[]
    } | null
    tags: { name: string }[]
    answer?: string | null
    takeaways: string[]
    blocks: ArticleBlock[]
    faq: FaqEntry[]
    sources: string[]
  }
  aiDisclosure?: string | null
  discloseAi?: boolean
  follow?: { count: number; following: boolean; visible: boolean; pending: boolean }
}>()

const emit = defineEmits<{ follow: []; share: [platform: SharePlatform] }>()

const localePath = useLocalePath()
const sourcesOpen = shallowRef(true)
const sources = computed(() => article.sources.filter((source) => source.trim()))

const content = useTemplateRef<HTMLElement>('content')
const hero = useTemplateRef<HTMLElement>('hero')
useArticleScrollContext(content, hero)
</script>
