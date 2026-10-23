export function useWidgetPagePreview() {
  const route = useRoute()
  const active = computed(() => route.query.widgetPreview === '1')
  const state = useState<WidgetPagePreviewState>('widget-page-preview', () => ({
    slot: 'HOME_TOP',
    kind: null,
    widget: null,
    editingId: null,
    interactive: false,
  }))
  return { active, state }
}

/** Installed once by the app; the existing publication routes supply all page content. */
export function useWidgetPagePreviewBridge() {
  const { active, state } = useWidgetPagePreview()
  if (import.meta.server || !active.value) return
  let receivedState = false
  useEventListener('message', async (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return
    const parsed = widgetPagePreviewUpdateSchema.safeParse(event.data)
    if (!parsed.success) return
    const next = parsed.data.state
    if (!canPreviewWidgetSlot(next.slot, next.kind)) return
    const shouldScroll = parsed.data.focus || state.value.slot !== next.slot || !receivedState
    state.value = next
    receivedState = true
    if (shouldScroll) {
      await nextTick()
      document
        .querySelector(`[data-widget-preview-slot="${next.slot}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  })

  // Reading and scrolling work; links, votes and forms cannot change data from this preview.
  const preventAction = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('[data-widget-preview-select]')) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  useEventListener(document, ['click', 'submit'], preventAction, { capture: true })
  onMounted(() => window.parent.postMessage({ type: 'topiqu:widget-preview:ready' }, window.location.origin))
}
