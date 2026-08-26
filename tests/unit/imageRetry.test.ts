import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildImageRetryUrl, canCacheBustImageUrl, useImageRetry } from '../../app/composables/useImageRetry'

afterEach(() => vi.useRealTimers())

describe('image retry URLs', () => {
  it('adds a stable retry marker while preserving existing query parameters', () => {
    expect(buildImageRetryUrl('https://cdn.test/image.webp', 2)).toBe('https://cdn.test/image.webp?topiqu_retry=2')
    expect(buildImageRetryUrl('https://cdn.test/image.webp?w=640', 3)).toBe(
      'https://cdn.test/image.webp?w=640&topiqu_retry=3',
    )
  })

  it('never mutates signed, authenticated, protocol-relative, or API image URLs', () => {
    expect(canCacheBustImageUrl('https://cdn.test/image.webp?X-Amz-Signature=secret')).toBe(false)
    expect(canCacheBustImageUrl('https://cdn.test/image.webp?token=secret')).toBe(false)
    expect(canCacheBustImageUrl('//cdn.test/image.webp')).toBe(false)
    expect(canCacheBustImageUrl('/api/private-image?id=1')).toBe(false)
    expect(canCacheBustImageUrl('https://cdn.test/image.webp?w=640')).toBe(true)
    expect(canCacheBustImageUrl('/uploads/image.webp')).toBe(true)
  })

  it('retries an optimized source before falling back to the stable original', async () => {
    vi.useFakeTimers()
    const source = ref('https://cdn.test/optimized.webp')
    const original = ref('https://uploads.test/original.jpg')
    const scope = effectScope()
    const state = scope.run(() => useImageRetry(source, original))!

    expect(state.currentSrc.value).toBe(source.value)
    for (let attempt = 1; attempt <= 3; attempt++) {
      state.handleError()
      expect(state.isRetrying.value).toBe(true)
      await vi.advanceTimersByTimeAsync(500 * 2 ** (attempt - 1))
      expect(state.currentSrc.value).toBe(buildImageRetryUrl(source.value, attempt))
    }

    state.handleError()
    expect(state.currentSrc.value).toBe(original.value)
    expect(state.usingOriginal.value).toBe(true)
    expect(state.isRetrying.value).toBe(true)
    scope.stop()
  })

  it('ends in a designed fallback state after the original also fails', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const state = scope.run(() => useImageRetry('optimized.webp', 'original.jpg'))!

    for (let cycle = 0; cycle < 2; cycle++) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        state.handleError()
        await vi.advanceTimersByTimeAsync(500 * 2 ** (attempt - 1))
      }
      state.handleError()
    }

    expect(state.currentSrc.value).toBeNull()
    expect(state.isRetrying.value).toBe(false)
    scope.stop()
  })

  it('resets retries when the media source changes', async () => {
    vi.useFakeTimers()
    const source = ref('first.webp')
    const scope = effectScope()
    const state = scope.run(() => useImageRetry(source))!
    state.handleError()
    source.value = 'second.webp'
    await vi.runAllTimersAsync()

    expect(state.currentSrc.value).toBe('second.webp')
    expect(state.isRetrying.value).toBe(false)
    scope.stop()
  })

  it('finishes in fallback when a replacement request silently stalls', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const state = scope.run(() => useImageRetry('/missing.webp'))!

    state.handleError()
    await vi.runAllTimersAsync()

    expect(state.currentSrc.value).toBeNull()
    expect(state.isRetrying.value).toBe(false)
    scope.stop()
  })
})
