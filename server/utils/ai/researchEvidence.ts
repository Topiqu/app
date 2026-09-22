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
