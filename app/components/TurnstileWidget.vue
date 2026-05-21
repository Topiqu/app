<template>
  <div ref="containerRef" class="cf-turnstile"></div>
</template>

<script setup lang="ts">
const token = defineModel<string>()
const containerRef = useTemplateRef<HTMLDivElement>('containerRef')
const config = useRuntimeConfig().public
const siteKey = config.turnstileSiteKey

let widgetId: string | undefined

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit'

const ensureScript = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.turnstile) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      window.onTurnstileLoad = () => resolve()
      return
    }
    window.onTurnstileLoad = () => resolve()
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  })

const renderWidget = async () => {
  if (!siteKey || !containerRef.value) return
  await ensureScript()
  if (!window.turnstile || !containerRef.value) return
  widgetId = window.turnstile.render(containerRef.value, {
    sitekey: siteKey,
    size: 'invisible',
    callback: (t: string) => {
      token.value = t
    },
    'error-callback': () => {
      token.value = ''
    },
    'expired-callback': () => {
      token.value = ''
    },
  })
}

onMounted(renderWidget)

onScopeDispose(() => {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
})

defineExpose({
  reset: () => {
    if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
  },
})
</script>
