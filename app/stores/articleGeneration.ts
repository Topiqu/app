import { defineStore } from 'pinia'
import {
  finishGenerationRun,
  reduceGenerationRun,
  startGenerationRun,
  type ArticleGenerationOptions,
  type GenerationRun,
} from '~~/shared/utils/articleGeneration'

import type { ClientSiteStatus } from '~/composables/useClientSite'

import { GenerationStreamError } from '~/composables/useArticleGeneration'

/** What the generation has produced so far, in the editor's field names. */
export interface GeneratedArticle {
  title?: string
  excerpt?: string
  content?: string
  sources?: string[]
  imageUrl?: string | null
  imageCredit?: unknown
  coverMediaId?: string | null
  answer?: string | null
  keyTakeaways?: string[]
  faq?: unknown
  format?: string
  aiInvolvement?: 'FULL'
  totalWords?: number
  savedAmount?: number
  savedTimeMinutes?: number
  tags?: string[]
}

const RUN_TOAST_COLOR = { completed: 'success', partial: 'warning', stopped: 'info', failed: 'error' } as const

/**
 * One manual generation at a time, owned by the app rather than the editor page, so leaving the
 * editor neither stops it nor needs the page kept alive. `target` is `'new'` or the article id.
 */
export const useArticleGenerationStore = defineStore('articleGeneration', () => {
  const { t } = useI18n()
  const toast = useToast()
  const { streamGenerate, stop: abort } = useArticleGeneration()

  const run = shallowRef<GenerationRun | null>(null)
  const target = shallowRef<string | null>(null)
  const editorPath = shallowRef('')
  const sessionId = shallowRef<string | null>(null)
  const article = shallowRef<GeneratedArticle>({})
  const stopRequested = shallowRef(false)
  const running = computed(() => run.value?.status === 'running')

  const wallet = () => useNuxtData<ClientSiteStatus | null>('clientsite-status').data.value?.articleWallet

  let stopping = false
  const requestStop = async () => {
    if (!running.value) return
    stopRequested.value = true
    // Before the session id arrives there is nothing to address; `onSession` retries.
    if (!sessionId.value || stopping) return
    stopping = true
    try {
      await $fetch(`/api/articles/generations/${sessionId.value}/stop`, { method: 'POST' })
      abort()
    } catch {
      stopRequested.value = false
      toast.add({ color: 'error', title: t('articles.editor.ai.stopFailed') })
    } finally {
      stopping = false
    }
  }

  const start = async (request: {
    prompt: string
    options: ArticleGenerationOptions
    target: string
    editorPath: string
    articleId?: string
  }) => {
    if (running.value) return
    run.value = startGenerationRun(request.options, Date.now())
    target.value = request.target
    editorPath.value = request.editorPath
    sessionId.value = null
    article.value = {}
    stopRequested.value = false

    const reservedBefore = wallet()?.reserved ?? 0
    let charged = false
    let streamedContent = ''
    const streamedImages = new Map<number, string>()
    const present = () => {
      let content = unwrapContentSlots(streamedContent)
      for (const [slot, html] of streamedImages) content = replaceSlot(content, 'IMAGE', slot, html)
      return stripContentSlots(content)
    }
    const update = (patch: GeneratedArticle) => (article.value = { ...article.value, ...patch })
    const settle = (next: GenerationRun) => (run.value = next)

    try {
      const outcome = await streamGenerate(
        request.prompt,
        request.options,
        {
          onEvent: (event) => run.value && settle(reduceGenerationRun(run.value, event, Date.now())),
          onSession: (id) => {
            sessionId.value = id
            if (stopRequested.value) void requestStop()
          },
          onPartial: (partial) => {
            if (partial.content != null) streamedContent = partial.content
            update({
              ...(partial.title != null ? { title: partial.title } : {}),
              ...(partial.perex != null ? { excerpt: partial.perex } : {}),
              ...(partial.sources != null ? { sources: partial.sources } : {}),
              ...(partial.content != null ? { content: present() } : {}),
            })
          },
          onResearch: (research) => update({ sources: research.sources }),
          onImage: ({ slot, html }) => {
            streamedImages.set(slot, html)
            update({ content: present() })
          },
          onReservation: (articles) => {
            const current = wallet()
            if (current)
              patchClientSiteArticleWallet({
                available: Math.max(0, current.available - articles),
                reserved: current.reserved + articles,
                balance: current.balance,
              })
          },
          onBilling: (result) => {
            charged = true
            const reserved = Math.max(reservedBefore, (wallet()?.reserved ?? 0) - (run.value?.reserved ?? 0))
            patchClientSiteArticleWallet({
              available: result.articlesRemaining,
              reserved,
              balance: result.articlesRemaining + reserved,
            })
          },
          onFinal: (final) => {
            streamedContent = ''
            update({
              title: final.title,
              excerpt: final.perex,
              content: final.content,
              imageUrl: final.articleImageUrl,
              imageCredit: final.articleImageCredit ?? null,
              coverMediaId: final.articleCoverMediaId ?? null,
              sources: final.sources ?? [],
              answer: final.answer || null,
              keyTakeaways: final.keyTakeaways ?? [],
              faq: final.faq ?? [],
              format: request.options.format,
              aiInvolvement: 'FULL',
              totalWords: final.metrics?.totalWords ?? 0,
              savedAmount: final.metrics?.savedAmount ?? 0,
              savedTimeMinutes: final.metrics?.savedTimeMinutes ?? 0,
              tags: Array.isArray(final.tags) ? final.tags : [],
            })
          },
        },
        request.articleId,
      )
      if (run.value) settle(finishGenerationRun(run.value, outcome, Date.now()))
    } catch (error: any) {
      const failure =
        error instanceof GenerationStreamError
          ? { message: error.message, stage: error.stage, creditReturned: error.creditReturned }
          : { message: error?.message || t('articles.editor.aiContentFailed') }
      if (run.value) settle(finishGenerationRun(run.value, failure, Date.now()))
    } finally {
      // Slots still unresolved when the stream ended must not reach the editor as raw markers.
      if (streamedContent) update({ content: present() })
      const status = run.value?.status
      if (status && status !== 'running')
        toast.add({ color: RUN_TOAST_COLOR[status], title: t(`articles.editor.ai.run.title.${status}`) })
      if (charged) await refreshClientSiteStatus().catch(() => undefined)
      else await refreshClientSiteStatusAfterStop(reservedBefore).catch(() => undefined)
    }
  }

  /** The editor saved or discarded the result; nothing is left to return to. */
  const clear = () => {
    if (running.value) return
    run.value = null
    target.value = null
    editorPath.value = ''
    sessionId.value = null
    article.value = {}
  }

  return { run, target, editorPath, sessionId, article, running, stopRequested, start, requestStop, clear }
})
