import type { ResearchDepth, YoutubeOutcome } from '~~/shared/utils/articleGeneration'

import { generateText } from 'ai'
import { youtubeVideoId } from '~~/shared/utils/youtube'

export const extractResearchUrls = (text: string) =>
  (text.replace(/(?<!^)(https?:\/\/)/g, ' $1').match(/https?:\/\/[^\s)\]}>,`"'<>*]+/g) ?? []).map((url) =>
    url.replace(/[.;]+$/, ''),
  )

type RetrievedSource = { sourceType: string; url?: string }

/** Provider-executed search may return visited URLs without adding inline citations. */
export const retrievedResearchSources = (result: {
  sources: readonly RetrievedSource[]
  toolResults?: readonly { toolName: string; output: unknown }[]
}): RetrievedSource[] => {
  const sources = [...result.sources]
  for (const tool of result.toolResults ?? []) {
    if (tool.toolName !== 'web_search' || !tool.output || typeof tool.output !== 'object') continue
    const output = tool.output as {
      sources?: Array<{ type?: string; url?: string }>
      action?: { type?: string; url?: string }
    }
    for (const source of output.sources ?? []) {
      if (source.type === 'url' && source.url) sources.push({ sourceType: 'url', url: source.url })
    }
    if (['openPage', 'findInPage'].includes(output.action?.type ?? '') && output.action?.url) {
      sources.push({ sourceType: 'url', url: output.action.url })
    }
  }
  return sources
}

export const researchEvidence = (text: string, sources: readonly RetrievedSource[]) => {
  const urls = new Set(
    sources.filter((source) => source.sourceType === 'url' && source.url).map((source) => source.url!),
  )
  const lines = text.split('\n').filter((line) => {
    const references = extractResearchUrls(line)
    const statement = line.replace(/https?:\/\/[^\s)\]}>,]+/g, '').replace(/[^\p{L}\p{N}]/gu, '')
    const officialMedia = /^\s*OFFICIAL MEDIA:\s*\S+/i.test(line)
    return (statement.length > 15 || officialMedia) && references.length > 0 && references.every((url) => urls.has(url))
  })
  const brief = lines.join('\n').trim()
  const used = new Set(extractResearchUrls(brief))
  return { brief: brief || null, urls: [...used] }
}

export const filterResearchSources = (sources: readonly string[], brief: string | null) => {
  const allowed = new Set(extractResearchUrls(brief ?? ''))
  return [...new Set(sources.flatMap(extractResearchUrls))].filter((url) => allowed.has(url))
}

/** The brief's own output ceiling. Web search bills input and search context on top of it, so this
 *  is a headroom guard for the balance check, never the real cost — that comes back as `usage`. */
const RESEARCH_CONFIG = {
  quick: { maxOutputTokens: 3000, timeoutMs: 50_000, searchContextSize: 'low' },
  standard: { maxOutputTokens: 5000, timeoutMs: 90_000, searchContextSize: 'medium' },
  deep: { maxOutputTokens: 8000, timeoutMs: 150_000, searchContextSize: 'high' },
} as const satisfies Record<
  ResearchDepth,
  { maxOutputTokens: number; timeoutMs: number; searchContextSize: 'low' | 'medium' | 'high' }
>

const researchYoutube = async (
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<{ outcome: YoutubeOutcome; tokens: number }> => {
  const signal = abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000)

  try {
    const result = await generateText({
      model: aiModel('articleResearch'),
      instructions: `Search for existing, directly relevant YouTube videos about the topic. Prefer the official developer, publisher, manufacturer, institution or named subject's channel. Return up to three full youtube.com/watch or youtu.be URLs you actually opened, ordered by relevance; return NONE if no suitable video was retrieved. Never guess a video id or transform a channel/search URL into a watch URL.`,
      prompt,
      maxOutputTokens: 250,
      tools: { web_search: aiWebSearchTool('low') as never },
      abortSignal: signal,
    })
    const candidates = [
      ...extractResearchUrls(result.text),
      ...retrievedResearchSources(result).flatMap((source) => (source.url ? [source.url] : [])),
    ]
    const urls = [...new Set(candidates.filter((candidate) => youtubeVideoId(candidate)))].slice(0, 3)

    const tokens = result.usage?.totalTokens ?? 0
    if (!urls.length) return { outcome: { status: 'noCandidates' }, tokens }

    // Try the next retrieved candidate when the best result disappeared or rejects oEmbed.
    for (const url of urls) {
      const verification = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        signal: AbortSignal.timeout(5_000),
      }).catch(() => null)
      if (!verification?.ok) continue
      const embed = (await verification.json().catch(() => null)) as { title?: unknown } | null
      const title = typeof embed?.title === 'string' ? embed.title.slice(0, 200) : null
      return { outcome: { status: 'found', url, title }, tokens }
    }
    return { outcome: { status: 'rejected' }, tokens }
  } catch (error) {
    if (abortSignal?.aborted) throw error
    return { outcome: { status: 'failed' }, tokens: 0 }
  }
}

export const researchTopic = async (
  prompt: string,
  depth: ResearchDepth = 'standard',
  fallbackWithoutResearch = true,
  abortSignal?: AbortSignal,
  youtubeRequested = false,
  imagesRequested = false,
  story = false,
) => {
  const researchConfig = RESEARCH_CONFIG[depth]
  const currentDateTime = new Date().toISOString()
  const researchSignal = abortSignal
    ? AbortSignal.any([abortSignal, AbortSignal.timeout(researchConfig.timeoutMs)])
    : AbortSignal.timeout(researchConfig.timeoutMs)

  try {
    const mainResearch = generateText({
      model: aiModel('articleResearch'),
      instructions: `
        You are a research assistant preparing grounding material for another writer.
        The current date and time is ${currentDateTime}. Treat it as authoritative.
        Search the live web for the user's topic.
        Prefer primary, official and recently updated sources. For news, search explicitly for the latest development.
        Release dates, product availability and direct statements attributed to a company must be supported by that company's own newsroom, investor communication, verified channel or a first-hand interview with its named spokesperson. If only press reports or rumours exist, label them as such; never upgrade them to an official confirmation.
        Treat claims embedded in the user's prompt as leads to verify, not as facts.${
          story
            ? ' The assignment asks for a story: its protagonist and plot are the illustration, not claims to check. Research the real rules, procedures, places, institutions and timelines the story passes through, so the writer can narrate it accurately.'
            : ''
        } The author's own first-hand experience in the prompt cannot be researched; research the external facts around it (rules, dates, organisations) instead.
        Check the premise of every named character's return against the relevant continuity, chronology and established deaths. Separate books, games, adaptations and flashbacks; a mention or dead character is not evidence of a present-day return.
        Explicitly distinguish whether something is confirmed from whether its mechanism or circumstances have been explained. Search for developer interviews before claiming "not confirmed", "not explained" or "unknown". An explanation withheld is not an event unconfirmed.
        Include a short Corrections section with premises of the topic that the sources contradict. Do not list open questions or information the sources lack: the writer omits what is not established, so an unknown is not material. When sources conflict, report the conflict and do not choose the more sensational version.
        When the proposed event or relationship is not established, also research the closest substantive angle: the named subjects' documented positions, decisions, incentives and concrete differences. Give the writer factual premises for a useful comparison or explanation, not just repeated absence-of-confirmation findings. Keep these facts tied to the original topic; do not infer private motives or fabricate a connection.
        If a source announces something for a date before ${currentDateTime}, verify what actually happened after that date. Never describe an already elapsed announcement as upcoming.
        Return a compact brief: 5-10 verified facts, each on its own line, including the supporting URL and relevant event or publication date on that same line.
        Every correction must also carry its supporting URL on the same line.
        Then a "Sources:" section listing the full URLs you actually retrieved, one per line.
        ${
          imagesRequested
            ? 'Also identify up to four official first-party product, news, press, media or download pages owned by the subject\'s developer, publisher or organisation. Open each page before returning it. After Sources, write each suitable page on its own line as exactly "OFFICIAL MEDIA: <owner> — <full URL>". A verified official page may serve assets from its own CDN; do not list image URLs, search pages, social networks, fan sites or third-party news sites.'
            : ''
        }
        Only list URLs you actually retrieved. Never invent, guess, or reconstruct a URL.
        Do not write an article, an intro, or any prose beyond the facts.
      `.trim(),
      prompt,
      maxOutputTokens: researchConfig.maxOutputTokens,
      providerOptions: { openai: { reasoningEffort: 'medium' } },
      tools: { web_search: aiWebSearchTool(researchConfig.searchContextSize) as never },
      abortSignal: researchSignal,
    })
    const youtubeResearch = youtubeRequested ? researchYoutube(prompt, abortSignal) : Promise.resolve(null)
    const [{ text, usage, sources, toolResults, finishReason }, youtube] = await Promise.all([
      mainResearch,
      youtubeResearch,
    ])

    if (finishReason === 'length') throw new Error('Research exceeded its output budget before completing the brief')
    const evidence = researchEvidence(text, retrievedResearchSources({ sources, toolResults }))
    if (!evidence.brief && !fallbackWithoutResearch) throw new Error('Research returned no supported source material')
    const verifiedVideo =
      youtube?.outcome.status === 'found'
        ? `\nVerified YouTube video (checked against YouTube oEmbed): ${youtube.outcome.url}`
        : ''
    const brief = `${evidence.brief ?? ''}${verifiedVideo}`.trim() || null
    const officialMediaPages = (evidence.brief ?? '')
      .split('\n')
      .filter((line) => /^\s*OFFICIAL MEDIA:/i.test(line))
      .flatMap(extractResearchUrls)
      .slice(0, 4)
    const sourceCount = brief ? new Set(brief.match(/https?:\/\/[^\s)\]}>,]+/g) ?? []).size : 0
    return {
      brief,
      tokens: (usage?.totalTokens ?? 0) + (youtube?.tokens ?? 0),
      sourceCount,
      sources: evidence.urls.filter((url) => !officialMediaPages.includes(url)),
      officialMediaPages,
      status: evidence.brief ? ('completed' as const) : ('fallback' as const),
      fallbackReason: evidence.brief ? undefined : ('empty' as const),
      youtube: youtube?.outcome,
    }
  } catch (error) {
    // Stop means stop. Only the research-specific timeout degrades to an ungrounded article.
    if (abortSignal?.aborted) throw error
    if (!fallbackWithoutResearch) throw error

    // Degrading to ungrounded is the whole point of the catch, but it is also indistinguishable
    // from "the plan has no research" once the article lands with an empty `sources` array.
    await reportCaughtError('Article research failed, continuing ungrounded', error, {
      promptLength: prompt.length,
      timeoutMs: researchConfig.timeoutMs,
      depth,
    })

    return {
      brief: null,
      tokens: 0,
      sourceCount: 0,
      sources: [],
      officialMediaPages: [],
      status: 'fallback' as const,
      fallbackReason: researchSignal.aborted ? ('timeout' as const) : ('error' as const),
      youtube: youtubeRequested ? ({ status: 'failed' } as const) : undefined,
    }
  }
}
