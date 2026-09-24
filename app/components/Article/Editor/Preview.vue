<template>
  <div
    data-article-scroller
    class="publication-surface h-full overflow-y-auto bg-default px-4 py-8 sm:px-6 lg:px-8"
    :style="themeStyle"
    @click.capture="blockNavigation"
  >
    <ArticleView :article :aiDisclosure :discloseAi>
      <template #empty>
        <p class="text-sm text-muted">{{ $t('articles.editor.preview.empty') }}</p>
      </template>
    </ArticleView>
  </div>
</template>

<script setup lang="ts">
import type { CoverCredit } from '~~/shared/utils/imageCredit'

import { readFaq } from '~~/shared/utils/articleFaq'

import type { ClientSiteStatus } from '~/composables/useClientSite'

// Polls are inert here: a poll only gets its `data-poll-id` from `syncArticlePolls` on save, and
// `ArticleParsed` degrades an unstamped block to raw HTML.
const props = defineProps<{
  title?: string | null
  excerpt?: string | null
  answer?: string | null
  takeaways?: string[]
  faq?: unknown
  content?: string | null
  imageUrl?: string | null
  imageCredit?: CoverCredit | null
  articleId?: string
  author?: { username: string; avatarUrl?: string | null } | null
  aiInvolvement?: string | null
  tags?: string[]
  sources?: string[]
  series?: { name: string; current: number; total: number } | null
}>()

const { t } = useI18n()
const { data: session } = useAuth()
const requestFetch = useRequestFetch()
// The editor lives on the platform host, where `useClientSite()` resolves no tenant.
const { data: clientStatus } = useNuxtData<ClientSiteStatus | null>('clientsite-status')

// Same key as the tag picker, so the preview costs no extra request.
const { data: allTags } = useQuery({
  key: () => queryKeys.tags.list,
  query: () => requestFetch<{ id: string; name: string }[]>('/api/tags'),
  placeholderData: () => [],
})

const themeStyle = computed(() =>
  clientStatus.value ? tenantThemeStyle(clientStatus.value.theme, clientStatus.value.typographyPreset) : undefined,
)
const discloseAi = computed(() => clientStatus.value?.discloseAiContent ?? false)
const aiDisclosure = computed(() =>
  discloseAi.value && props.aiInvolvement && props.aiInvolvement !== 'NONE' ? props.aiInvolvement : null,
)

const article = computed(() => ({
  id: props.articleId ?? '',
  title: props.title || t('common.labels.articleTitle'),
  excerpt: props.excerpt,
  imageUrl: props.imageUrl,
  imageCredit: props.imageCredit ?? null,
  // A new article has no author yet; saving assigns the signed-in user.
  author: props.author ?? {
    username: session.value?.user?.name ?? '',
    avatarUrl: session.value?.user?.avatarUrl ?? null,
  },
  series: props.series,
  tags: (allTags.value ?? []).filter((tag) => props.tags?.includes(tag.id)),
  answer: props.answer,
  takeaways: props.takeaways ?? [],
  // Unsaved content never reached the API, so it is split with the same shared builder.
  blocks: props.content && props.content !== '<p></p>' ? parseArticleBlocks(props.content).blocks : [],
  faq: readFaq(props.faq),
  sources: props.sources ?? [],
}))

// Every link here points at the live site; following one would leave the editor mid-edit.
const blockNavigation = (event: MouseEvent) => {
  const link = (event.target as Element | null)?.closest('a[href]')
  if (!link || link.getAttribute('href')?.startsWith('#') || link.getAttribute('target') === '_blank') return
  event.preventDefault()
  event.stopPropagation()
}
</script>
