<template>
  <article class="custom-ui flex flex-col gap-8">
    <ArticleHeaderHero
      :title="title || $t('common.labels.articleTitle')"
      :author="author"
      :followerCount="0"
      :isFollowing="false"
      :showFollowButton="false"
      :excerpt="excerpt"
      :imageUrl="imageUrl"
      :series="series"
    />

    <div v-if="tagNames.length" class="flex flex-wrap gap-2.5">
      <span
        v-for="name in tagNames"
        :key="name"
        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700! bg-white dark:text-gray-200! dark:bg-gray-800 border-gray-200 dark:border-gray-600"
      >
        <Icon name="mdi:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />{{ name }}
      </span>
    </div>

    <ArticleSummary :answer="answer" :takeaways="takeaways" />

    <div v-if="hasBody" :class="ARTICLE_PROSE_CLASS">
      <ArticleParsed :blocks="previewBlocks" :articleId="articleId ?? ''" />
    </div>
    <p v-else class="text-sm text-gray-500 dark:text-gray-400">
      {{ $t('articles.editor.preview.empty') }}
    </p>

    <ArticleFaq :entries="readFaq(faq)" />

    <div v-if="filledSources.length" class="pt-6 border-t border-gray-200 dark:border-gray-700">
      <h2 class="flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-gray-300">
        <Icon name="mdi:book-open-page-variant" class="w-5 h-5 text-blue-500 dark:text-blue-400" aria-hidden="true" />
        {{ $t('articles.columns.sources') }}
      </h2>
      <ul class="mt-4 flex flex-col gap-2 pl-1 list-none">
        <li v-for="source in filledSources" :key="source" class="text-sm">
          <span class="text-blue-600 dark:text-blue-400 underline break-all">{{ source }}</span>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
import { readFaq } from '~~/shared/utils/articleFaq'
import { ARTICLE_PROSE_CLASS } from '~~/shared/utils/articleProse'

/**
 * Composes the real published-article components rather than restyling their output, so the
 * preview cannot drift from `pages/clanky/[slug].vue`. Polls are inert here: a poll only gets
 * its `data-poll-id` from `syncArticlePolls` on save, and `ArticleParsed` already degrades an
 * unstamped block to raw HTML instead of rendering a widget whose votes would go nowhere.
 */
const {
  content,
  answer,
  takeaways = [],
  faq,
  tags = [],
  sources = [],
} = defineProps<{
  title?: string | null
  excerpt?: string | null
  answer?: string | null
  takeaways?: string[]
  faq?: unknown
  content?: string | null
  imageUrl?: string | null
  articleId?: string
  tags?: string[]
  sources?: string[]
  series?: { name: string; current: number; total: number } | null
}>()

const { data: session } = useAuth()
const requestFetch = useRequestFetch()

// The session carries `name`; `Hero.vue` labels it `username` because that is what the public
// payload calls the same field.
const author = computed(() => ({
  username: session.value?.user?.name ?? '',
  avatarUrl: session.value?.user?.avatarUrl ?? null,
}))

// Same key as the tag picker, so the preview costs no extra request.
const { data: allTags } = useQuery({
  key: () => queryKeys.tags.list,
  query: () => requestFetch<{ id: string; name: string }[]>('/api/tags'),
  placeholderData: () => [],
})

const tagNames = computed(() => (allTags.value ?? []).filter((tag) => tags.includes(tag.id)).map((tag) => tag.name))
const filledSources = computed(() => sources.filter((source) => source.trim()))
const hasBody = computed(() => !!content && content !== '<p></p>')

// Unsaved content never reached the API, so the preview splits it with the same shared builder.
const previewBlocks = computed(() => parseArticleBlocks(content).blocks)
</script>
