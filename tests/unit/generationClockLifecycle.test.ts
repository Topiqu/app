// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { GenerationRun } from '../../shared/utils/articleGeneration'

import Run from '../../app/components/Article/Editor/GenerationRun.vue'
import Activity from '../../app/components/Article/GenerationActivity.vue'
import {
  defaultArticleGenerationOptions,
  finishGenerationRun,
  startGenerationRun,
} from '../../shared/utils/articleGeneration'

const route = reactive({ path: '/admin', fullPath: '/admin', query: {}, params: {}, hash: '', meta: {} })
const generation = reactive({
  run: null as GenerationRun | null,
  article: { title: '' },
  editorPath: '/admin/editor/new',
  get running() {
    return this.run?.status === 'running'
  },
  clear: vi.fn(),
})
mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('useArticleGenerationStore', () => () => generation)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, te: () => false }))
mockNuxtImport('useLocalePath', () => () => () => '/admin')
mockNuxtImport('useTenantScope', () => () => () => false)
mockNuxtImport('useLazyFetch', () => () => ({ data: shallowRef([]), status: shallowRef('idle'), refresh: vi.fn() }))
const Slideover = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.body?.()),
})
const global = {
  renderStubDefaultSlot: true,
  stubs: { USlideover: Slideover },
  mocks: {
    $t: (key: string, params?: { seconds?: number }) =>
      key === 'articles.editor.ai.elapsed' ? `elapsed:${params?.seconds}` : key,
  },
}
const running = () => startGenerationRun(defaultArticleGenerationOptions(), Date.now())
const mountActivity = () => mountSuspended(Activity, { shallow: true, global })
const mountRun = (run: GenerationRun) => mountSuspended(Run, { props: { run, words: 0 }, shallow: true, global })

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
  generation.run = null
  route.path = '/admin'
})
afterEach(() => vi.useRealTimers())

describe('generation clock scheduling', () => {
  it('schedules no idle activity timer, ticks only while visible, and resumes from current time', async () => {
    const wrapper = await mountActivity()
    expect(vi.getTimerCount()).toBe(0)
    generation.run = running()
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(wrapper.text()).toContain('elapsed:1')
    route.path = generation.editorPath
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(5_000)
    route.path = '/admin'
    await nextTick()
    expect(wrapper.text()).toContain('elapsed:6')
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops the background clock when a run finishes and retains the final elapsed time', async () => {
    generation.run = running()
    const wrapper = await mountActivity()
    await vi.advanceTimersByTimeAsync(2_000)
    generation.run = finishGenerationRun(generation.run!, 'aborted', Date.now())
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    expect(wrapper.text()).toContain('elapsed:2')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.text()).toContain('elapsed:2')
  })

  it('stops the editor run timer after completion and releases it on unmount', async () => {
    const run = running()
    const wrapper = await mountRun(run)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(3_000)
    await wrapper.setProps({ run: finishGenerationRun(run, 'aborted', Date.now()) })
    expect(vi.getTimerCount()).toBe(0)
    expect(wrapper.text()).toContain('elapsed:3')
    await wrapper.setProps({ run: running() })
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a timer for an already finished result', async () => {
    const run = finishGenerationRun(running(), 'aborted', Date.now())
    await mountRun(run)
    generation.run = run
    await mountActivity()
    expect(vi.getTimerCount()).toBe(0)
  })
})
