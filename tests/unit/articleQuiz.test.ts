// @vitest-environment nuxt

import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { enableAutoUnmount } from '@vue/test-utils'
import { createError, getQuery, readBody } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import Quiz from '../../app/components/Article/Quiz.vue'
import Poll from '../../app/components/Article/Poll.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({ toast: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))

type VoteState = { pollResult: string | null; voteCounts: Record<string, number>; open: boolean }
let state: VoteState
let failVote = false
const posted: unknown[] = []

registerEndpoint('/api/articles/a1/vote', {
  method: 'GET',
  handler: (event) => ({ ...state, pollId: getQuery(event).pollId }),
})
registerEndpoint('/api/articles/a1/vote', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody<{ optionId: string }>(event)
    posted.push(body)
    if (failVote) throw createError({ statusCode: 409, message: 'already voted' })
    state.voteCounts[body.optionId] = (state.voteCounts[body.optionId] ?? 0) + 1
    return { pollResult: body.optionId, voteCounts: state.voteCounts }
  },
})

beforeEach(() => {
  state = { pollResult: null, voteCounts: { o1: 1, o2: 3 }, open: true }
  failVote = false
  posted.length = 0
  vi.clearAllMocks()
})

const quiz = {
  pollId: 'p1',
  question: 'How many legs does a spider have?',
  options: [
    { id: 'o1', label: 'Six' },
    { id: 'o2', label: 'Eight', correct: true },
    { id: 'o3', label: 'Ten' },
  ],
  explanation: 'Arachnids have eight legs.',
}

const i18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: {
      en: {
        articles: {
          quiz: { correctShare: '{percent}% correct', incorrect: 'Wrong, it is {answer}' },
          votes: 'Votes',
        },
      },
    },
  })

const settle = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 30))
}

const mountQuiz = async () => {
  const wrapper = await mountSuspended(Quiz, { props: { quiz, articleId: 'a1' }, global: { plugins: [i18n()] } })
  await settle()
  return wrapper
}

const result = (wrapper: Awaited<ReturnType<typeof mountQuiz>>) => wrapper.find('[aria-live="polite"]')

describe('Article quiz', () => {
  it('answers once, then reveals the correct option, the explanation and the share answering correctly', async () => {
    const wrapper = await mountQuiz()
    expect(result(wrapper).text()).toBe('')

    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['Six', 'Eight', 'Ten'])
    await buttons[0]!.trigger('click')
    await settle()

    expect(posted).toEqual([{ pollId: 'p1', optionId: 'o1' }])
    expect(wrapper.findAll('button')).toHaveLength(0)
    const rows = wrapper.findAll('li').map((li) => li.text())
    expect(rows[0]).toContain('articles.quiz.yourAnswer')
    expect(rows[1]).toContain('articles.quiz.correctAnswer')
    expect(rows[2]).not.toContain('articles.quiz')
    // 3 of 5 answers picked the correct option.
    expect(result(wrapper).text()).toContain('Wrong, it is Eight')
    expect(result(wrapper).text()).toContain('Arachnids have eight legs.')
    expect(result(wrapper).text()).toContain('60% correct')
  })

  it('shows the earlier answer on load without offering the options again', async () => {
    state.pollResult = 'o2'
    const wrapper = await mountQuiz()

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(result(wrapper).text()).toContain('articles.quiz.correct')
    expect(result(wrapper).text()).toContain('75% correct')
  })

  it('takes no answers while the article is not live', async () => {
    state.open = false
    const wrapper = await mountQuiz()

    expect(wrapper.text()).toContain('articles.quiz.notOpenYet')
    expect(wrapper.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })

  it('reverts the optimistic answer when the vote is refused', async () => {
    failVote = true
    const wrapper = await mountQuiz()
    await wrapper.findAll('button')[1]!.trigger('click')
    await settle()

    expect(wrapper.findAll('button')).toHaveLength(3)
    expect(result(wrapper).text()).toBe('')
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })
})

describe('Article poll on usePollVotes', () => {
  it('casts a vote and shows the shares', async () => {
    const wrapper = await mountSuspended(Poll, {
      props: { poll: { type: 'poll', pollId: 'p1', question: 'Q', options: quiz.options }, articleId: 'a1' },
      global: { plugins: [i18n()] },
    })
    await settle()
    await wrapper.findAll('button')[0]!.trigger('click')
    await settle()

    expect(posted).toEqual([{ pollId: 'p1', optionId: 'o1' }])
    expect(wrapper.text()).toContain('40%')
    expect(wrapper.text()).toContain('5 votes')
  })
})
