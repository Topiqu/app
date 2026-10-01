import { defineStore } from 'pinia'
import {
  finishGenerationRun,
  missingArticleModules,
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
  excerpt?: string | null
  content?: string | null
  slug?: string
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
const STORAGE_KEY = 'topiqu-article-generation'
const RESUME_POLL_MS = 3_000
const RESUME_LIMIT_MS = 15 * 60_000

/** The server's copy of the finished article, from the stream's `final` or the session snapshot. */
type FinalArticle = {
  title?: string
  perex?: string
  content?: string
  sources?: string[]
  articleImageUrl?: string | null
  articleImageCredit?: unknown
  articleCoverMediaId?: string | null
  answer?: string | null
  keyTakeaways?: string[]
  faq?: unknown
  tags?: unknown
  format?: string
  metrics?: { totalWords?: number; savedAmount?: number; savedTimeMinutes?: number }
}

type ResumedSession = {
  status: string
  recoverableSnapshot: FinalArticle | null
  failureReason: string | null
}

const generatedFromFinal = (final: FinalArticle, format?: string): GeneratedArticle => ({
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
  format: format ?? final.format,
  aiInvolvement: 'FULL',
  totalWords: final.metrics?.totalWords ?? 0,
  savedAmount: final.metrics?.savedAmount ?? 0,
  savedTimeMinutes: final.metrics?.savedTimeMinutes ?? 0,
  tags: Array.isArray(final.tags) ? final.tags : [],
})

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
  const language = shallowRef<ArticleGenerationOptions['language']>()
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
    language.value = request.options.language
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
            update(generatedFromFinal(final, request.options.format))
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
    language.value = undefined
    sessionId.value = null
    article.value = {}
  }

  // A full page load (the public site, a refresh) ends the stream but not the server's run: the
  // state survives in sessionStorage and the finished article is read back from the session.
  const settleResumed = (outcome: Parameters<typeof finishGenerationRun>[1]) => {
    if (!run.value) return
    // A completed session got past writing even though its phase events never arrived.
    const phase = outcome === 'completed' ? 'images' : run.value.phase
    run.value = finishGenerationRun({ ...run.value, phase, resumed: true }, outcome, Date.now())
    const status = run.value.status as keyof typeof RUN_TOAST_COLOR
    toast.add({ color: RUN_TOAST_COLOR[status], title: t(`articles.editor.ai.run.title.${status}`) })
    void refreshClientSiteStatus().catch(() => undefined)
  }

  const resume = async () => {
    const id = sessionId.value
    if (!id) return settleResumed({ message: t('articles.editor.aiContentFailed') })
    const deadline = Date.now() + RESUME_LIMIT_MS
    for (;;) {
      const session = await $fetch<ResumedSession>(`/api/articles/generations/${id}/status`).catch((error) =>
        error?.statusCode === 404
          ? ({ status: 'FAILED', recoverableSnapshot: null, failureReason: null } as const)
          : null,
      )
      // Cleared, stopped or replaced by a new run while the request was out.
      if (run.value?.status !== 'running' || sessionId.value !== id) return
      const finished = !!session && !['RESERVED', 'RESEARCHING', 'WRITING', 'FINALIZING'].includes(session.status)
      if (!finished && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, RESUME_POLL_MS))
        continue
      }
      if (session?.recoverableSnapshot && session.status !== 'FAILED') {
        article.value = { ...article.value, ...generatedFromFinal(session.recoverableSnapshot) }
        const { content, answer, keyTakeaways, faq } = article.value
        const missingModules = missingArticleModules(
          { content, answer, keyTakeaways, faq: Array.isArray(faq) ? faq : [] },
          run.value.modules,
        )
        run.value = reduceGenerationRun(run.value, { type: 'final', missingModules }, Date.now())
      }
      if (session?.status === 'INTERRUPTED') return settleResumed('aborted')
      if (finished && session.status !== 'FAILED') return settleResumed('completed')
      return settleResumed({ message: session?.failureReason || t('articles.editor.aiContentFailed') })
    }
  }

  if (import.meta.client) {
    // Read before hydration: the payload's empty state would otherwise be persisted over it.
    let saved: ({ run?: GenerationRun } & Record<string, any>) | null = null
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    const persist = () => {
      if (saved) return
      if (!run.value) return sessionStorage.removeItem(STORAGE_KEY)
      const state = { run: run.value, target: target.value, editorPath: editorPath.value, language: language.value }
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, sessionId: sessionId.value, article: article.value }),
      )
    }
    watchThrottled([run, target, editorPath, language, sessionId, article], persist, { throttle: 1_000 })
    useEventListener(window, 'pagehide', persist)
    // After hydration, so the server-rendered editor matches before the restored run appears.
    onNuxtReady(() => {
      const restored = saved
      saved = null
      if (!restored?.run || run.value) return persist()
      run.value = restored.run
      target.value = restored.target
      editorPath.value = restored.editorPath
      language.value = restored.language
      sessionId.value = restored.sessionId
      article.value = restored.article ?? {}
      if (restored.run.status === 'running') void resume()
    })
  }

  return { run, target, editorPath, language, sessionId, article, running, stopRequested, start, requestStop, clear }
})
