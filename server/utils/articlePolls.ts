import * as cheerio from 'cheerio'

import { normalizePollOptions, normalizeQuizOptions, type QuizOptionData } from '../../shared/utils/polls'

/**
 * Minimal surface of the (enhanced) Prisma client this util needs. Kept loose so
 * it works with both the raw and the ZenStack-enhanced client.
 */
type PollDb = {
  poll: {
    findFirst: (args: any) => Promise<{ id: string; options: { id: string }[] } | null>
    create: (args: any) => Promise<{ id: string }>
    update: (args: any) => Promise<unknown>
    deleteMany: (args: any) => Promise<unknown>
  }
  pollOption: {
    create: (args: any) => Promise<{ id: string }>
    update: (args: any) => Promise<unknown>
    deleteMany: (args: any) => Promise<unknown>
  }
}

const DEFAULT_QUESTION = 'Q1'
const DEFAULT_OPTION = 'A1'

// Both normalizers fall back to one default option on anything that is not an array.
const parseOptions = (raw: string | undefined, normalize: (raw: unknown) => QuizOptionData[]) => {
  try {
    return normalize(JSON.parse(raw || '[]'))
  } catch {
    return normalize([])
  }
}

/**
 * Reconciles the `Poll` / `PollOption` rows of an article with the poll and quiz blocks
 * embedded in its HTML content, and stamps each block with stable, server-assigned
 * `data-poll-id` (on the block) and option ids (inside `data-options`).
 *
 * Question/option labels stay mirrored in the HTML so the editor round-trips and
 * client rendering needs no DB read; votes (`PollResult`) reference the option by
 * FK, so renaming a label never splits counts and removing one cleans up its votes.
 * A quiz is a poll whose correct option is flagged in the HTML only.
 *
 * @returns the (possibly mutated) content HTML fragment to persist.
 */
export const syncArticlePolls = async (db: PollDb, articleId: string, content: string | null): Promise<string> => {
  if (!content) {
    await db.poll.deleteMany({ where: { articleId } })
    return content ?? ''
  }

  const $ = cheerio.load(content)
  // One selector list, so polls and quizzes come back in document order and share `order`.
  const nodes = $('div[data-type="poll"], div[data-type="quiz"]').toArray()
  const seenPollIds: string[] = []

  for (let order = 0; order < nodes.length; order++) {
    const $el = $(nodes[order]!)
    const isQuiz = $el.attr('data-type') === 'quiz'
    const question = ($el.attr('data-question') || '').trim() || DEFAULT_QUESTION
    const options = parseOptions($el.attr('data-options'), isQuiz ? normalizeQuizOptions : normalizePollOptions)

    const existingId = $el.attr('data-poll-id')
    let pollId: string | undefined
    let knownOptionIds = new Set<string>()

    // A row already claimed earlier in this document (a copied block, a poll and a quiz sharing an id)
    // is foreign to this block: adopting it would overwrite the other block's options and delete its votes.
    if (existingId && !seenPollIds.includes(existingId)) {
      const existing = await db.poll.findFirst({
        where: { id: existingId, articleId },
        select: { id: true, options: { select: { id: true } } },
      })
      if (existing) {
        await db.poll.update({ where: { id: existingId }, data: { question, order } })
        pollId = existingId
        knownOptionIds = new Set(existing.options.map((o) => o.id))
      }
    }

    if (!pollId) {
      const created = await db.poll.create({ data: { articleId, question, order } })
      pollId = created.id
      $el.attr('data-poll-id', pollId)
    }

    const seenOptionIds: string[] = []
    for (let oi = 0; oi < options.length; oi++) {
      const opt = options[oi]!
      const label = opt.label.trim() || DEFAULT_OPTION
      if (opt.id && knownOptionIds.has(opt.id)) {
        await db.pollOption.update({ where: { id: opt.id }, data: { label, order: oi } })
        seenOptionIds.push(opt.id)
      } else {
        const created = await db.pollOption.create({ data: { pollId, label, order: oi } })
        opt.id = created.id
        seenOptionIds.push(created.id)
      }
    }

    if (seenOptionIds.length) {
      await db.pollOption.deleteMany({
        where: { pollId, id: { notIn: seenOptionIds } },
      })
    }

    $el.attr(
      'data-options',
      JSON.stringify(
        options.map((o) => ({
          id: o.id,
          label: o.label.trim() || DEFAULT_OPTION,
          ...(o.correct ? { correct: true } : {}),
        })),
      ),
    )
    seenPollIds.push(pollId)
  }

  if (seenPollIds.length) {
    await db.poll.deleteMany({
      where: { articleId, id: { notIn: seenPollIds } },
    })
  } else {
    await db.poll.deleteMany({ where: { articleId } })
  }

  return $('body').html() ?? content
}
