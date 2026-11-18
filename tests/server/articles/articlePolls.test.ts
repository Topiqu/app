import { beforeEach, describe, expect, it, vi } from 'vitest'

import { syncArticlePolls } from '../../../server/utils/articlePolls'

const ARTICLE = 'article-1'

const makeDb = (polls: Array<{ id: string; options: string[] }> = []) => {
  const pollMap = new Map(polls.map((p) => [p.id, p.options.map((id) => ({ id }))]))
  let createdPolls = 0
  let createdOpts = 0
  const db = {
    poll: {
      findFirst: vi.fn(async ({ where }: any) =>
        pollMap.has(where.id) ? { id: where.id, options: pollMap.get(where.id)! } : null,
      ),
      create: vi.fn(async () => ({ id: `new-poll-${++createdPolls}` })),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({})),
    },
    pollOption: {
      create: vi.fn(async () => ({ id: `new-opt-${++createdOpts}` })),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({})),
    },
  }
  return db
}

const optionsAttr = (opts: Array<{ id?: string; label: string; correct?: boolean }>) =>
  JSON.stringify(opts).replace(/"/g, '&quot;')

const block = (type: 'poll' | 'quiz', attrs: Record<string, string>) => {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  return `<div data-type="${type}" ${a}></div>`
}
const pollBlock = (attrs: Record<string, string>) => block('poll', attrs)
const quizBlock = (attrs: Record<string, string>) => block('quiz', attrs)

// The rewritten `data-options` of each block, in document order.
const optionsOf = (html: string) =>
  [...html.matchAll(/data-options="([^"]*)"/g)].map((m) => JSON.parse(m[1]!.replace(/&quot;/g, '"')))

describe('syncArticlePolls', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a Poll + PollOptions for a new block and stamps ids back into the HTML', async () => {
    const db = makeDb()
    const content = pollBlock({
      'data-question': 'Líbí se ti to?',
      'data-options': optionsAttr([{ label: 'Ano' }, { label: 'Ne' }]),
    })

    const result = await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).toHaveBeenCalledWith({
      data: { articleId: ARTICLE, question: 'Líbí se ti to?', order: 0 },
    })
    expect(db.pollOption.create).toHaveBeenCalledTimes(2)
    expect(db.pollOption.create).toHaveBeenNthCalledWith(1, {
      data: { pollId: 'new-poll-1', label: 'Ano', order: 0 },
    })
    expect(result).toContain('data-poll-id="new-poll-1"')
    // option ids written back into data-options
    expect(result).toContain('new-opt-1')
    expect(result).toContain('new-opt-2')
  })

  it('updates an existing option by id and creates a newly added one', async () => {
    const db = makeDb([{ id: 'poll-1', options: ['opt-a'] }])
    const content = pollBlock({
      'data-poll-id': 'poll-1',
      'data-question': 'Otázka',
      'data-options': optionsAttr([{ id: 'opt-a', label: 'Ano (přejmenováno)' }, { label: 'Nová' }]),
    })

    await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).not.toHaveBeenCalled()
    expect(db.poll.update).toHaveBeenCalledWith({ where: { id: 'poll-1' }, data: { question: 'Otázka', order: 0 } })
    expect(db.pollOption.update).toHaveBeenCalledWith({
      where: { id: 'opt-a' },
      data: { label: 'Ano (přejmenováno)', order: 0 },
    })
    expect(db.pollOption.create).toHaveBeenCalledWith({ data: { pollId: 'poll-1', label: 'Nová', order: 1 } })
  })

  it('deletes options removed from a block, keeping the survivors', async () => {
    const db = makeDb([{ id: 'poll-1', options: ['opt-a', 'opt-b'] }])
    const content = pollBlock({
      'data-poll-id': 'poll-1',
      'data-question': 'Q',
      'data-options': optionsAttr([{ id: 'opt-a', label: 'A' }]),
    })

    await syncArticlePolls(db, ARTICLE, content)

    expect(db.pollOption.deleteMany).toHaveBeenCalledWith({
      where: { pollId: 'poll-1', id: { notIn: ['opt-a'] } },
    })
  })

  it('mints a fresh Poll when data-poll-id does not belong to the article', async () => {
    const db = makeDb() // findFirst → null
    const content = pollBlock({
      'data-poll-id': 'foreign-id',
      'data-question': 'Q',
      'data-options': optionsAttr([{ id: 'foreign-opt', label: 'A' }]),
    })

    const result = await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).toHaveBeenCalledTimes(1)
    expect(result).toContain('data-poll-id="new-poll-1"')
    expect(result).not.toContain('foreign-id')
    // a copy-pasted option id is not trusted either
    expect(db.pollOption.create).toHaveBeenCalledWith({ data: { pollId: 'new-poll-1', label: 'A', order: 0 } })
  })

  it('makes an AI-authored block votable: data-id alone yields no ids to vote against', async () => {
    const db = makeDb()
    // Exactly what finalizeArticle emits: a random data-id, labels with no option ids,
    // and the options JSON HTML-escaped.
    const content =
      `<div data-type="poll" data-id="7c9e6679-7425-40de-944b-e07fc1f90ae7" data-question="Kde by vám AI ušetřila nejvíc času?" ` +
      `data-options="${optionsAttr([{ label: 'Třídění e-mailů' }, { label: 'Návrhy odpovědí' }])}"></div>`

    const result = await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).toHaveBeenCalledTimes(1)
    expect(db.pollOption.create).toHaveBeenCalledTimes(2)
    // The block is only votable once both the poll id and every option id are stamped in:
    // Poll.vue bails before $fetch on a missing option id, and vote.post.ts 404s on a
    // pollId with no row behind it.
    expect(result).toContain('data-poll-id="new-poll-1"')
    expect(result).toContain('new-opt-1')
    expect(result).toContain('new-opt-2')
    // data-id is not a vote target and must not be mistaken for one
    expect(result).not.toContain('data-poll-id="7c9e6679-7425-40de-944b-e07fc1f90ae7"')
    // the escaped options attribute round-trips into real labels, not mangled entities
    expect(db.pollOption.create).toHaveBeenNthCalledWith(1, {
      data: { pollId: 'new-poll-1', label: 'Třídění e-mailů', order: 0 },
    })
  })

  it('deletes polls whose block was removed', async () => {
    const db = makeDb([{ id: 'poll-keep', options: ['opt-a'] }])
    const content = pollBlock({
      'data-poll-id': 'poll-keep',
      'data-question': 'Q',
      'data-options': optionsAttr([{ id: 'opt-a', label: 'A' }]),
    })

    await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.deleteMany).toHaveBeenCalledWith({
      where: { articleId: ARTICLE, id: { notIn: ['poll-keep'] } },
    })
  })

  it('removes all polls when content is empty', async () => {
    const db = makeDb()

    const result = await syncArticlePolls(db, ARTICLE, null)

    expect(db.poll.deleteMany).toHaveBeenCalledWith({ where: { articleId: ARTICLE } })
    expect(result).toBe('')
  })

  it('falls back to defaults for malformed options', async () => {
    const db = makeDb()
    const content = pollBlock({ 'data-question': '', 'data-options': 'not-json' })

    await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).toHaveBeenCalledWith({ data: { articleId: ARTICLE, question: 'Q1', order: 0 } })
    expect(db.pollOption.create).toHaveBeenCalledWith({ data: { pollId: 'new-poll-1', label: 'A1', order: 0 } })
  })

  it('gives a copied poll a row of its own instead of sharing the original’s', async () => {
    const db = makeDb([{ id: 'poll-1', options: ['opt-a'] }])
    const copy = pollBlock({
      'data-poll-id': 'poll-1',
      'data-question': 'P',
      'data-options': optionsAttr([{ id: 'opt-a', label: 'A' }]),
    })

    const result = await syncArticlePolls(db, ARTICLE, copy + copy)

    expect(db.poll.create).toHaveBeenCalledTimes(1)
    expect(optionsOf(result)).toEqual([[{ id: 'opt-a', label: 'A' }], [{ id: 'new-opt-1', label: 'A' }]])
    expect(db.poll.deleteMany).toHaveBeenCalledWith({
      where: { articleId: ARTICLE, id: { notIn: ['poll-1', 'new-poll-1'] } },
    })
  })
})

describe('syncArticlePolls with quizzes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores a quiz like a poll and keeps the correct flag on the option it was written on', async () => {
    const db = makeDb()
    const content = quizBlock({
      'data-question': 'Kolik nohou má pavouk?',
      'data-options': optionsAttr([{ label: 'Šest' }, { label: 'Osm', correct: true }, { label: 'Deset' }]),
      'data-explanation': 'Pavoukovci mají &quot;osm&quot; noh.',
    })

    const result = await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).toHaveBeenCalledWith({
      data: { articleId: ARTICLE, question: 'Kolik nohou má pavouk?', order: 0 },
    })
    expect(db.pollOption.create).toHaveBeenCalledTimes(3)
    expect(result).toContain('data-type="quiz"')
    expect(result).toContain('data-poll-id="new-poll-1"')
    expect(optionsOf(result)).toEqual([
      [
        { id: 'new-opt-1', label: 'Šest' },
        { id: 'new-opt-2', label: 'Osm', correct: true },
        { id: 'new-opt-3', label: 'Deset' },
      ],
    ])
    expect(result).toContain('data-explanation="Pavoukovci mají &quot;osm&quot; noh."')
  })

  it('keeps one correct option, and a poll never gains the flag', async () => {
    const db = makeDb([
      { id: 'quiz-1', options: ['q-a', 'q-b'] },
      { id: 'poll-1', options: ['p-a'] },
    ])
    const content =
      quizBlock({
        'data-poll-id': 'quiz-1',
        'data-question': 'Q',
        'data-options': optionsAttr([
          { id: 'q-a', label: 'A (renamed)', correct: true },
          { id: 'q-b', label: 'B', correct: true },
        ]),
      }) +
      pollBlock({
        'data-poll-id': 'poll-1',
        'data-question': 'P',
        'data-options': optionsAttr([{ id: 'p-a', label: 'A', correct: true }]),
      })

    const result = await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.create).not.toHaveBeenCalled()
    expect(db.pollOption.update).toHaveBeenCalledWith({
      where: { id: 'q-a' },
      data: { label: 'A (renamed)', order: 0 },
    })
    expect(optionsOf(result)).toEqual([
      [
        { id: 'q-a', label: 'A (renamed)', correct: true },
        { id: 'q-b', label: 'B' },
      ],
      [{ id: 'p-a', label: 'A' }],
    ])
  })

  it('orders polls and quizzes together, in document order', async () => {
    const db = makeDb([
      { id: 'poll-1', options: ['p1'] },
      { id: 'quiz-1', options: ['q1'] },
      { id: 'poll-2', options: ['p2'] },
    ])
    const opts = (id: string) => optionsAttr([{ id, label: id }])
    const content =
      pollBlock({ 'data-poll-id': 'poll-1', 'data-question': 'P1', 'data-options': opts('p1') }) +
      '<p>text</p>' +
      quizBlock({ 'data-poll-id': 'quiz-1', 'data-question': 'Q1', 'data-options': opts('q1') }) +
      pollBlock({ 'data-poll-id': 'poll-2', 'data-question': 'P2', 'data-options': opts('p2') })

    await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.update.mock.calls.map(([args]: any) => [args.where.id, args.data.order])).toEqual([
      ['poll-1', 0],
      ['quiz-1', 1],
      ['poll-2', 2],
    ])
    // A quiz row is no orphan to the poll cleanup.
    expect(db.poll.deleteMany).toHaveBeenCalledWith({
      where: { articleId: ARTICLE, id: { notIn: ['poll-1', 'quiz-1', 'poll-2'] } },
    })
  })

  it('gives a quiz that claims a poll’s row a row of its own, leaving the poll’s options alone', async () => {
    const db = makeDb([{ id: 'poll-1', options: ['opt-a', 'opt-b'] }])
    const content =
      pollBlock({
        'data-poll-id': 'poll-1',
        'data-question': 'P',
        'data-options': optionsAttr([
          { id: 'opt-a', label: 'A' },
          { id: 'opt-b', label: 'B' },
        ]),
      }) +
      quizBlock({
        'data-poll-id': 'poll-1',
        'data-question': 'Q',
        'data-options': optionsAttr([{ id: 'opt-a', label: 'A', correct: true }]),
      })

    const result = await syncArticlePolls(db, ARTICLE, content)

    expect(db.poll.findFirst).toHaveBeenCalledTimes(1)
    expect(db.poll.update).toHaveBeenCalledTimes(1)
    expect(db.poll.create).toHaveBeenCalledWith({ data: { articleId: ARTICLE, question: 'Q', order: 1 } })
    // Only the poll pass touches the poll's options; the quiz cannot rename or prune them.
    expect(db.pollOption.update).toHaveBeenCalledTimes(2)
    expect(db.pollOption.create).toHaveBeenCalledWith({ data: { pollId: 'new-poll-1', label: 'A', order: 0 } })
    expect(db.pollOption.deleteMany).toHaveBeenCalledTimes(2)
    expect(db.pollOption.deleteMany).toHaveBeenLastCalledWith({
      where: { pollId: 'new-poll-1', id: { notIn: ['new-opt-1'] } },
    })
    expect(result).toContain('data-poll-id="new-poll-1"')
    expect(optionsOf(result)[1]).toEqual([{ id: 'new-opt-1', label: 'A', correct: true }])
  })
})
