// @vitest-environment nuxt
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import type { WebsiteImportProgress, WebsiteImportView } from '../../shared/utils/websiteImport'

import Progress from '../../app/components/WebsiteImport/Progress.vue'
import { websiteImportReason } from '../../app/utils/websiteImportReason'
import { WEBSITE_IMPORT_ERROR_CODES, WEBSITE_IMPORT_WAIT_CODES } from '../../shared/utils/websiteImport'

const translate = (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
mockNuxtImport('useI18n', () => () => ({ t: translate }))

const at = new Date().toISOString()
const render = (status: WebsiteImportView['status'], progress: WebsiteImportProgress) =>
  mount(Progress, {
    props: { job: { status, progress } },
    global: { mocks: { $t: translate }, stubs: { UIcon: true } },
  })
const stateOf = (wrapper: ReturnType<typeof render>, step: string) =>
  wrapper.find(`[data-step="${step}"]`).attributes('data-state')

describe('website import progress', () => {
  it('shows finished, running and upcoming steps with each loaded page', () => {
    const wrapper = render('PROCESSING', {
      steps: {
        address: { state: 'done', at },
        search: { state: 'done', at, count: 2 },
        pages: { state: 'running', at, count: 1 },
      },
      pages: [
        { url: 'https://www.firma.cz/', state: 'done' },
        { url: 'https://firma.cz/o-n%C3%A1s', state: 'failed' },
      ],
    })
    expect(['address', 'search', 'pages', 'brand', 'analysis'].map((step) => stateOf(wrapper, step))).toEqual([
      'done',
      'done',
      'running',
      'pending',
      'pending',
    ])
    expect(wrapper.find('[data-step="pages"]').attributes('aria-current')).toBe('step')
    expect(wrapper.text()).toContain('common.websiteImport.progress.found:{"count":2}')
    expect(wrapper.text()).toContain('firma.cz/o-nás')
    expect(wrapper.text()).toContain('common.websiteImport.progress.page.failed')
  })

  it('marks where a failed import stopped and what never ran', () => {
    const wrapper = render('FAILED', {
      steps: { address: { state: 'done', at }, search: { state: 'running', at } },
      pages: [],
    })
    expect(stateOf(wrapper, 'search')).toBe('failed')
    expect(stateOf(wrapper, 'pages')).toBe('skipped')
    expect(wrapper.text()).toContain('common.websiteImport.progress.failedHere')
  })

  it('explains a finished step with a warning', () => {
    const wrapper = render('PROCESSING', {
      steps: { brand: { state: 'warning', at, code: 'assetUnavailable' } },
      pages: [],
    })
    expect(wrapper.text()).toContain('common.websiteImport.warnings.assetUnavailable')
  })
})

describe('website import reasons', () => {
  const messages = JSON.parse(readFileSync(join(process.cwd(), 'i18n/locales/cs/common.json'), 'utf8'))
  const resolve = (key: string) =>
    key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], messages)

  it('has copy for every code a queued or failed import can carry', () => {
    const keys = [
      ...WEBSITE_IMPORT_WAIT_CODES.map((errorCode) => websiteImportReason({ status: 'PENDING', errorCode })),
      ...WEBSITE_IMPORT_ERROR_CODES.map((errorCode) => websiteImportReason({ status: 'FAILED', errorCode })),
    ]
    expect(keys.filter((key) => typeof resolve(key ?? '') !== 'string')).toEqual([])
  })

  it('falls back to the generic copy for unknown or running states', () => {
    expect(websiteImportReason({ status: 'FAILED', errorCode: 'PROCESSING_FAILED' })).toBeNull()
    expect(websiteImportReason({ status: 'PROCESSING', errorCode: null })).toBeNull()
    expect(websiteImportReason({ status: 'PENDING', errorCode: 'DAILY_BUDGET' })).toBe(
      'common.websiteImport.budgetWait',
    )
  })
})
