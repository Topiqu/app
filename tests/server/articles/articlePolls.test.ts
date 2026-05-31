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

const optionsAttr = (opts: Array<{ id?: string; label: string }>) =>
  JSON.stringify(opts).replace(/"/g, '&quot;')

const pollBlock = (attrs: Record<string, string>) => {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  return `<div data-type="poll" ${a}></div>`
}

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
})
