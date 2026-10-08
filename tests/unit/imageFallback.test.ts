import { effectScope, nextTick, ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageFallback } from '../../app/composables/useImageFallback'

const context = vi.hoisted(() => ({
  states: new Map<string, ReturnType<typeof ref>>(),
  isHydrating: false,
}))
mockNuxtImport('useState', () => (key: string, init: () => unknown) => {
  if (!context.states.has(key)) context.states.set(key, ref(init()))
  return context.states.get(key)
})
mockNuxtImport('useNuxtApp', () => () => context)

beforeEach(() => {
  context.states.clear()
  context.isHydrating = false
})

const run = <T>(fn: () => T) => {
  const scope = effectScope()
  return { state: scope.run(fn)!, stop: () => scope.stop() }
}

describe('useImageFallback', () => {
  it('falls back to the original instead of reloading a failed optimized source', () => {
    const { state, stop } = run(() => useImageFallback('https://cdn.test/a.webp', 'https://uploads.test/a.jpg'))

    expect(state.currentSrc.value).toBe('https://cdn.test/a.webp')
    state.handleError()
    expect(state.currentSrc.value).toBe('https://uploads.test/a.jpg')
    expect(state.usingOriginal.value).toBe(true)
    stop()
  })

  it('ends in the fallback state once the original also fails', () => {
    const { state, stop } = run(() => useImageFallback('b.webp', 'b.jpg'))

    state.handleError()
    state.handleError()
    expect(state.currentSrc.value).toBeNull()
    stop()
  })

  it('does not fall back to an original identical to the failed source', () => {
    const { state, stop } = run(() => useImageFallback('c.webp', 'c.webp'))

    state.handleError()
    expect(state.currentSrc.value).toBeNull()
    stop()
  })

  it('skips a URL that already failed on a later mount', () => {
    const first = run(() => useImageFallback('d.webp', 'd.jpg'))
    first.state.handleError()
    first.stop()

    const { state, stop } = run(() => useImageFallback('d.webp', 'd.jpg'))
    expect(state.currentSrc.value).toBe('d.jpg')
    expect(state.usingOriginal.value).toBe(true)
    stop()
  })

  it('starts over when the source changes', async () => {
    const source = ref('e.webp')
    const { state, stop } = run(() => useImageFallback(source))

    state.handleError()
    source.value = 'f.webp'
    await nextTick()
    expect(state.currentSrc.value).toBe('f.webp')
    stop()
  })

  it('does not share a failed source with another Nuxt app or SSR request', () => {
    const first = run(() => useImageFallback('isolated.webp'))
    first.state.handleError()
    first.stop()

    context.states.clear()
    const second = run(() => useImageFallback('isolated.webp'))
    expect(second.state.currentSrc.value).toBe('isolated.webp')
    second.stop()
  })

  it('preserves the SSR image when another component fails the same URL during hydration', () => {
    const first = run(() => useImageFallback('hydration.webp'))
    first.state.handleError()
    first.stop()

    context.isHydrating = true
    const second = run(() => useImageFallback('hydration.webp', 'hydration.webp'))
    expect(second.state.currentSrc.value).toBe('hydration.webp')
    second.state.handleError()
    expect(second.state.currentSrc.value).toBeNull()
    second.stop()
  })
})
