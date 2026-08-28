import { describe, expect, it } from 'vitest'

import { buildTopicPrompt, researchRequest, topicSchema } from '../../../server/utils/ai/topic'

const INPUT = {
  focus: 'personal finance',
  audience: 'Czech freelancers',
  keywords: ['taxes', 'invoicing'],
  language: 'cs',
  recentExcerpts: ['How to write your first invoice', 'Choosing an accountant'],
  suggestion: 'Readers keep asking about the new flat-tax bracket',
}

describe('buildTopicPrompt', () => {
  it('lists the covered ground so the model can avoid it', () => {
    const prompt = buildTopicPrompt(INPUT)

    expect(prompt).toContain('- How to write your first invoice')
    expect(prompt).toContain('- Choosing an accountant')
    expect(prompt).toContain('ALREADY COVERED')
  })

  it('passes the client profile through', () => {
    const prompt = buildTopicPrompt(INPUT)

    expect(prompt).toContain('personal finance')
    expect(prompt).toContain('Czech freelancers')
    expect(prompt).toContain('taxes, invoicing')
    expect(prompt).toContain('Language: CS')
  })

  it('surfaces the community suggestion when there is one', () => {
    expect(buildTopicPrompt(INPUT)).toContain('new flat-tax bracket')
  })

  it('degrades to explicit placeholders rather than empty sections', () => {
    const prompt = buildTopicPrompt({ language: 'en', recentExcerpts: [] })

    expect(prompt).toContain('- nothing yet')
    expect(prompt).toContain('Focus: general topics')
    expect(prompt).toContain('Audience: general')
    expect(prompt).toContain('Keywords: none')
    expect(prompt).toContain('none')
  })

  it('does not ask the model to write the article', () => {
    expect(buildTopicPrompt(INPUT)).not.toMatch(/perex|headings|valid JSON/i)
  })

  it('offers the format catalogue and the shapes already used', () => {
    const prompt = buildTopicPrompt({
      ...INPUT,
      recentFormats: ['guide', 'guide', 'analysis'],
      recentStructures: ['guide / checklist / faq', 'analysis / claim-audit / table'],
    })

    expect(prompt).toContain('- opinion:')
    expect(prompt).toContain('guide, guide, analysis')
    expect(prompt).toContain('three most recent')
    expect(prompt).toContain('guide / checklist / faq')
    expect(prompt).toContain('An empty module set is valid')
  })

  it('frames Search Console as optional enrichment', () => {
    const prompt = buildTopicPrompt({
      ...INPUT,
      searchSignals: ['Query "enterprise security" has 500 impressions.'],
    })

    expect(prompt).toContain('enterprise security')
    expect(prompt).toContain('not the editorial strategy')
    expect(prompt).toContain('Missing search data is neutral')
  })

  it('says so rather than listing nothing on a blog with no history', () => {
    expect(buildTopicPrompt(INPUT)).toContain('nothing yet')
  })
})

describe('researchRequest', () => {
  it('requests the search when the topic depends on facts that move', () => {
    expect(researchRequest({ needsResearch: true, searchQuery: 'czech flat tax 2026' })).toEqual({
      query: 'czech flat tax 2026',
    })
  })

  it('skips the search for an evergreen topic', () => {
    expect(researchRequest({ needsResearch: false, searchQuery: 'czech flat tax 2026' })).toBe(false)
  })

  it('skips rather than searching an empty query when the model contradicts itself', () => {
    expect(researchRequest({ needsResearch: true, searchQuery: '' })).toBe(false)
    expect(researchRequest({ needsResearch: true, searchQuery: '   ' })).toBe(false)
  })

  it('trims the query it hands to the search step', () => {
    expect(researchRequest({ needsResearch: true, searchQuery: '  ai regulation eu  ' })).toEqual({
      query: 'ai regulation eu',
    })
  })
})

describe('topicSchema editorial choices', () => {
  const BASE_TOPIC = {
    topic: 'How enterprise teams should evaluate SSO readiness',
    angle: 'Audit the evidence behind common security claims',
    format: 'analysis',
    variant: 'claim-audit',
    modules: ['answer'],
    needsResearch: false,
    searchQuery: '',
  }

  it('accepts a variant and modules belonging to the selected format', () => {
    expect(topicSchema.safeParse(BASE_TOPIC).success).toBe(true)
  })

  it('rejects a variant borrowed from another format', () => {
    expect(topicSchema.safeParse({ ...BASE_TOPIC, variant: 'checklist' }).success).toBe(false)
  })

  it('rejects a module the format cannot carry', () => {
    expect(topicSchema.safeParse({ ...BASE_TOPIC, modules: ['faq'] }).success).toBe(false)
  })
})
