// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import PlanItem from '../../app/components/Keywords/PlanItem.vue'
import PromptRow from '../../app/components/Stats/Visibility/PromptRow.vue'

enableAutoUnmount(afterEach)

const run = (owned: boolean) => ({
  id: `run-${owned}`,
  provider: 'OPENAI',
  status: 'SUCCEEDED',
  executedAt: '2026-10-01T10:00:00.000Z',
  error: null,
  responseText: null,
  citations: [{ owned, url: 'https://csu.gov.cz/a', normalizedUrl: 'csu.gov.cz/a', title: null, domain: 'csu.gov.cz' }],
})

const prompt = (runs: unknown[]) => ({
  id: 'p1',
  text: 'Jak odhadnout náklady na stavbu domu?',
  language: 'cs',
  source: 'GENERATED',
  active: true,
  latestRuns: runs,
})

const opportunity = {
  id: 'o1',
  status: 'OPEN',
  citedDomains: ['csu.gov.cz', 'ckait.cz', 'crr.gov.cz', 'mpo.gov.cz', 'sreality.cz'],
  prompt: { id: 'p1', text: 'Jak odhadnout náklady na stavbu domu?' },
  article: null,
}

const mountRow = (props: Record<string, unknown>) =>
  mountSuspended(PromptRow, {
    props: { prompt: prompt([run(false)]), canSample: true, running: false, disabled: false, actions: [], ...props },
  })

describe('visibility prompt row', () => {
  it('shows the verdict as a cited/checked badge with the sentence kept for screen readers', async () => {
    const wrapper = await mountRow({})

    expect(wrapper.text()).toContain('0/1')
    expect(wrapper.find('.sr-only').text()).not.toBe('')
  })

  it('carries the opportunity inline: three cited domains, the overflow count and an editor link', async () => {
    const wrapper = await mountRow({ opportunity })

    for (const domain of ['csu.gov.cz', 'ckait.cz', 'crr.gov.cz']) expect(wrapper.text()).toContain(domain)
    expect(wrapper.text()).not.toContain('sreality.cz')
    expect(wrapper.text()).toContain('+2')
    const link = wrapper.find('a[href*="ai=1"]')
    expect(link.exists()).toBe(true)
    expect(decodeURIComponent(link.attributes('href')!)).toContain('/new')
  })

  it('has no editor link without an opportunity', async () => {
    const wrapper = await mountRow({})

    expect(wrapper.find('a[href*="ai=1"]').exists()).toBe(false)
  })
})

const cluster = (volume: number, difficulty: number | null = 10) => ({
  id: 'c1',
  keyword: 'pasport stavby cena',
  volume,
  difficulty,
  pillar: 'stavby',
  status: 'OPEN',
  reason: null,
})

const mountPlanItem = (volume: number, showDifficulty: boolean) =>
  mountSuspended(PlanItem, {
    props: { cluster: cluster(volume), busy: false, position: 1, maxVolume: 1000, showDifficulty },
    // UTooltip needs the UApp provider, which a lone row does not have.
    global: { stubs: { UTooltip: { template: '<slot />' } } },
  })

describe('keyword plan row', () => {
  it('hides the difficulty label when every topic shares it', async () => {
    const wrapper = await mountPlanItem(320, false)

    expect(wrapper.text()).toContain('stavby')
    expect(wrapper.find('.bg-success').exists()).toBe(false)
  })

  it('shows the difficulty label once topics differ', async () => {
    const wrapper = await mountPlanItem(320, true)

    expect(wrapper.find('.bg-success').exists()).toBe(true)
  })

  it('draws the volume bar relative to the largest topic', async () => {
    const wrapper = await mountPlanItem(250, false)

    expect(wrapper.find('[style*="width"]').attributes('style')).toContain('25%')
  })
})
