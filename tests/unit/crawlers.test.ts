import { describe, expect, it } from 'vitest'

import { ANSWER_ENGINE_BOTS, detectCrawler } from '../../shared/utils/crawlers'

describe('detectCrawler', () => {
  it('classifies retrieval bots as answer engines', () => {
    expect(detectCrawler('Mozilla/5.0 (compatible; OAI-SearchBot/1.0)')).toEqual({
      bot: 'OAI-SearchBot',
      kind: 'answer-engine',
    })
    expect(detectCrawler('Mozilla/5.0 (compatible; PerplexityBot/1.0)')?.kind).toBe('answer-engine')
  })

  it('classifies corpus builders as training', () => {
    expect(detectCrawler('Mozilla/5.0 (compatible; GPTBot/1.2)')).toEqual({ bot: 'GPTBot', kind: 'training' })
    expect(detectCrawler('CCBot/2.0 (https://commoncrawl.org/faq/)')?.kind).toBe('training')
  })

  /** The reason matching is longest-first — shortest-first labels both of these `ClaudeBot`. */
  it('does not let a shorter token swallow a longer one', () => {
    expect(detectCrawler('Claude-SearchBot/1.0')?.bot).toBe('Claude-SearchBot')
    expect(detectCrawler('ClaudeBot/1.0')?.bot).toBe('ClaudeBot')
  })

  it('does not know the grounding tokens, which never issue a request', () => {
    // `Google-Extended` and `Applebot-Extended` are robots.txt control tokens with no user agent
    // of their own; Apple fetches as plain `Applebot`.
    expect(detectCrawler('Mozilla/5.0 (compatible; Google-Extended)')).toBeNull()
    expect(detectCrawler('Applebot/0.1')?.bot).toBe('Applebot')
  })

  it('is case-insensitive, matching robots.txt semantics', () => {
    expect(detectCrawler('mozilla/5.0 (compatible; claudebot/1.0)')?.bot).toBe('ClaudeBot')
  })

  it('ignores browsers and empty agents', () => {
    expect(detectCrawler('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBeNull()
    expect(detectCrawler(undefined)).toBeNull()
    expect(detectCrawler('')).toBeNull()
  })

  it('recognises every bot the robots.txt group names', () => {
    for (const bot of ANSWER_ENGINE_BOTS) {
      expect(detectCrawler(`Mozilla/5.0 (compatible; ${bot}/1.0)`)?.bot, bot).toBe(bot)
    }
  })
})
