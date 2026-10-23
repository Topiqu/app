// @vitest-environment nuxt

import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'

import { effectScope } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTiptapSlashCommand, type SlashCommandItem } from '../../app/composables/useTiptapSlashCommand'

const mocks = vi.hoisted(() => ({
  keyDown: vi.fn(),
  renderers: [] as { destroy: ReturnType<typeof vi.fn>; updateProps: ReturnType<typeof vi.fn> }[],
  popups: [] as {
    destroy: ReturnType<typeof vi.fn>
    hide: ReturnType<typeof vi.fn>
    show: ReturnType<typeof vi.fn>
    setProps: ReturnType<typeof vi.fn>
  }[],
}))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
vi.mock('@tiptap/vue-3', () => ({
  VueRenderer: class {
    element = document.createElement('div')
    ref = { onKeyDown: mocks.keyDown }
    destroy = vi.fn()
    updateProps = vi.fn()
    constructor() {
      mocks.renderers.push(this)
    }
  },
}))
vi.mock('tippy.js', () => ({
  default: vi.fn(() => {
    const popup = { destroy: vi.fn(), hide: vi.fn(), show: vi.fn(), setProps: vi.fn() }
    mocks.popups.push(popup)
    return popup
  }),
}))
const scopes: ReturnType<typeof effectScope>[] = []
const setup = () => {
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() =>
    useTiptapSlashCommand({ openImagePrompt: vi.fn(), openYoutubePrompt: vi.fn(), insertPoll: vi.fn() }),
  )!
  return { scope, renderer: state.suggestion.render() }
}
const props = (clientRect?: () => DOMRect | null) =>
  ({ editor: {}, clientRect, items: [], query: '' }) as unknown as SuggestionProps<SlashCommandItem>
const key = (value: string) => ({ event: new KeyboardEvent('keydown', { key: value }) }) as SuggestionKeyDownProps

beforeEach(() => {
  vi.clearAllMocks()
  mocks.renderers.length = 0
  mocks.popups.length = 0
  mocks.keyDown.mockReturnValue(false)
})
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('slash command overlay lifecycle', () => {
  it('handles a missing caret rectangle, including Escape, before a popup exists', () => {
    const { renderer } = setup()
    renderer.onStart(props())
    expect(() => renderer.onUpdate(props(() => null))).not.toThrow()
    expect(renderer.onKeyDown(key('Escape'))).toBe(true)
    expect(mocks.popups).toHaveLength(0)
    renderer.onExit()
    expect(mocks.renderers[0]?.destroy).toHaveBeenCalledTimes(1)
  })

  it('creates the popup when a caret rectangle becomes available and reuses it on updates', () => {
    const { renderer } = setup()
    renderer.onStart(props())
    renderer.onUpdate(props(() => new DOMRect(10, 20, 0, 20)))
    renderer.onUpdate(props(() => new DOMRect(15, 20, 0, 20)))
    expect(mocks.popups).toHaveLength(1)
    expect(mocks.popups[0]?.setProps).toHaveBeenCalledTimes(1)
    renderer.onUpdate(props(() => null))
    expect(mocks.popups[0]?.hide).toHaveBeenCalledTimes(1)
  })

  it('disposes a replaced renderer and popup exactly once', () => {
    const { renderer } = setup()
    renderer.onStart(props(() => new DOMRect()))
    renderer.onStart(props(() => new DOMRect()))
    expect(mocks.popups[0]?.destroy).toHaveBeenCalledTimes(1)
    expect(mocks.renderers[0]?.destroy).toHaveBeenCalledTimes(1)
    renderer.onExit()
    renderer.onExit()
    expect(mocks.popups[1]?.destroy).toHaveBeenCalledTimes(1)
    expect(mocks.renderers[1]?.destroy).toHaveBeenCalledTimes(1)
  })

  it('cleans every active overlay on scope disposal and ignores late extension callbacks', () => {
    const { scope, renderer } = setup()
    renderer.onStart(props(() => new DOMRect()))
    scope.stop()
    renderer.onExit()
    renderer.onUpdate(props(() => new DOMRect()))
    renderer.onStart(props(() => new DOMRect()))
    expect(renderer.onKeyDown(key('Enter'))).toBe(false)
    expect(mocks.renderers).toHaveLength(1)
    expect(mocks.popups).toHaveLength(1)
    expect(mocks.renderers[0]?.destroy).toHaveBeenCalledTimes(1)
    expect(mocks.popups[0]?.destroy).toHaveBeenCalledTimes(1)
  })

  it('delegates keyboard navigation only to an active command list', () => {
    const { renderer } = setup()
    expect(renderer.onKeyDown(key('ArrowDown'))).toBe(false)
    renderer.onStart(props())
    mocks.keyDown.mockReturnValueOnce(true)
    expect(renderer.onKeyDown(key('ArrowDown'))).toBe(true)
    expect(mocks.keyDown).toHaveBeenCalledTimes(1)
    renderer.onExit()
    expect(renderer.onKeyDown(key('Enter'))).toBe(false)
    expect(mocks.keyDown).toHaveBeenCalledTimes(1)
  })
})
