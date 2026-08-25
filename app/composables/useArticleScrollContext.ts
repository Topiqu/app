export interface ArticleHeading {
  id: string
  level: 1 | 2 | 3
  text: string
}

export interface ArticleHeaderContext {
  articleId: string
  backTo: string
  canEdit: boolean
  liked: boolean
  title: string
}

const normalizeHeadingId = (text: string, index: number) => {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return normalized || `heading-${index + 1}`
}

export const useArticleHeaderContext = () =>
  useState<ArticleHeaderContext | null>('topiqu-article-header-context', () => null)

export const useArticleLikeBus = () => useEventBus<undefined>('topiqu-article-like')

export const useArticleScrollState = () =>
  useState('topiqu-article-scroll-state', () => ({
    activeId: '',
    headings: [] as ArticleHeading[],
    progress: 0,
    showHeader: false,
  }))

export const articleReadingProgress = (
  scrollTop: number,
  viewportHeight: number,
  viewportTop: number,
  contentRect: Pick<DOMRect, 'top' | 'height'>,
) => {
  const contentTop = scrollTop + contentRect.top - viewportTop
  const contentEnd = contentTop + contentRect.height - viewportHeight
  const range = Math.max(1, contentEnd - contentTop)
  const percentage = Math.min(100, Math.max(0, ((scrollTop - contentTop) / range) * 100))
  return Math.round(percentage * 10) / 10
}

export const useArticleScrollContext = (content: Ref<HTMLElement | null>, hero: Ref<HTMLElement | null>) => {
  const state = useArticleScrollState()
  const scrollContainer = shallowRef<HTMLElement | null>(null)

  const collectHeadings = () => {
    if (!content.value) return
    const usedIds = new Set<string>()
    state.value.headings = Array.from(content.value.querySelectorAll<HTMLElement>('h1, h2, h3')).map(
      (heading, index) => {
        const baseId = heading.id || normalizeHeadingId(heading.textContent || '', index)
        let id = baseId
        let duplicate = 2
        while (usedIds.has(id)) id = `${baseId}-${duplicate++}`
        usedIds.add(id)
        heading.id = id
        return {
          id,
          level: Number(heading.tagName.slice(1)) as 1 | 2 | 3,
          text: heading.textContent?.trim() || id,
        }
      },
    )
  }

  const update = () => {
    if (!import.meta.client || !content.value) return
    const scroller = scrollContainer.value
    const scrollTop = scroller?.scrollTop ?? window.scrollY
    const viewportHeight = scroller?.clientHeight ?? window.innerHeight
    const viewportTop = scroller?.getBoundingClientRect().top ?? 0
    const scrollHeight = scroller?.scrollHeight ?? document.documentElement.scrollHeight
    state.value.progress = articleReadingProgress(
      scrollTop,
      viewportHeight,
      viewportTop,
      content.value.getBoundingClientRect(),
    )
    state.value.showHeader = Boolean(hero.value && hero.value.getBoundingClientRect().bottom <= viewportTop)

    const activationLine = viewportTop + 24
    const headingElements = state.value.headings
      .map(({ id }) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => Boolean(heading))
    const active = headingElements.filter((heading) => heading.getBoundingClientRect().top <= activationLine).at(-1)
    state.value.activeId = active?.id || headingElements[0]?.id || ''
    if (scrollTop + viewportHeight >= scrollHeight - 2) {
      state.value.progress = 100
      state.value.activeId = headingElements.at(-1)?.id || state.value.activeId
    }
  }

  onMounted(async () => {
    await nextTick()
    scrollContainer.value = content.value?.closest<HTMLElement>('.topiqu-dashboard-scroll') ?? null
    collectHeadings()
    update()
  })
  useResizeObserver(content, () => {
    collectHeadings()
    update()
  })
  useEventListener(() => scrollContainer.value ?? window, 'scroll', update, { passive: true })

  onUnmounted(() => {
    state.value = { activeId: '', headings: [], progress: 0, showHeader: false }
  })

  return state
}
