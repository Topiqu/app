export type VisibilitySource = { sourceType: 'url'; url: string; title?: string }

export type ResponsesApiResponse = {
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      annotations?: Array<{ type?: string; url?: string; title?: string }>
    }>
  }>
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
}

export const parseResponsesApiResult = (result: ResponsesApiResponse) => {
  const messages = (result.output ?? []).filter((item) => item.type === 'message')
  const text = messages
    .flatMap((item) => item.content ?? [])
    .filter((block) => block.type === 'output_text' && block.text)
    .map((block) => block.text)
    .join('\n')
  const sources: VisibilitySource[] = messages.flatMap((item) =>
    (item.content ?? []).flatMap((block) =>
      (block.annotations ?? []).flatMap((annotation) =>
        annotation.type === 'url_citation' && annotation.url
          ? [{ sourceType: 'url', url: annotation.url, ...(annotation.title ? { title: annotation.title } : {}) }]
          : [],
      ),
    ),
  )
  return {
    text,
    sources,
    searchedWeb: (result.output ?? []).some((item) => item.type === 'web_search_call'),
    usage: result.usage ?? {},
    totalTokens: result.usage?.total_tokens ?? 0,
  }
}

export type AnthropicResponse = {
  content?: Array<{
    type?: string
    name?: string
    text?: string
    citations?: Array<{ type?: string; url?: string; title?: string }>
  }>
  usage?: { input_tokens?: number; output_tokens?: number; [key: string]: unknown }
}

export const parseAnthropicResult = (result: AnthropicResponse) => {
  const content = result.content ?? []
  const text = content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
  const sources: VisibilitySource[] = content.flatMap((block) =>
    (block.citations ?? []).flatMap((citation) =>
      citation.type === 'web_search_result_location' && citation.url
        ? [{ sourceType: 'url', url: citation.url, ...(citation.title ? { title: citation.title } : {}) }]
        : [],
    ),
  )
  const usage = result.usage ?? {}
  return {
    text,
    sources,
    searchedWeb: content.some(
      (block) =>
        block.type === 'web_search_tool_result' || (block.type === 'server_tool_use' && block.name === 'web_search'),
    ),
    usage,
    totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
  }
}

export type GoogleResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    groundingMetadata?: {
      webSearchQueries?: string[]
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
      groundingSupports?: Array<{ groundingChunkIndices?: number[] }>
    }
  }>
  usageMetadata?: { totalTokenCount?: number; [key: string]: unknown }
}

export const parseGoogleResult = (result: GoogleResponse) => {
  const candidate = result.candidates?.[0]
  const metadata = candidate?.groundingMetadata
  const citedIndexes = new Set(
    (metadata?.groundingSupports ?? []).flatMap((support) => support.groundingChunkIndices ?? []),
  )
  const sources: VisibilitySource[] = (metadata?.groundingChunks ?? []).flatMap((chunk, index) =>
    citedIndexes.has(index) && chunk.web?.uri
      ? [{ sourceType: 'url', url: chunk.web.uri, ...(chunk.web.title ? { title: chunk.web.title } : {}) }]
      : [],
  )
  return {
    text: (candidate?.content?.parts ?? []).flatMap((part) => (part.text ? [part.text] : [])).join('\n'),
    sources,
    searchedWeb: Boolean(metadata?.webSearchQueries?.length || metadata?.groundingChunks?.length),
    usage: result.usageMetadata ?? {},
    totalTokens: result.usageMetadata?.totalTokenCount ?? 0,
  }
}

export type MistralResponse = {
  outputs?: Array<{
    type?: string
    name?: string
    content?: string | Array<{ type?: string; text?: string; url?: string; title?: string }>
  }>
  usage?: { total_tokens?: number; [key: string]: unknown }
}

export const parseMistralResult = (result: MistralResponse) => {
  const messages = (result.outputs ?? []).filter((output) => output.type === 'message.output')
  const chunks = messages.flatMap((message) =>
    typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : (message.content ?? []),
  )
  const sources: VisibilitySource[] = chunks.flatMap((chunk) =>
    chunk.type === 'tool_reference' && chunk.url
      ? [{ sourceType: 'url', url: chunk.url, ...(chunk.title ? { title: chunk.title } : {}) }]
      : [],
  )
  return {
    text: chunks
      .filter((chunk) => chunk.type === 'text' && chunk.text)
      .map((chunk) => chunk.text)
      .join('\n'),
    sources,
    searchedWeb: (result.outputs ?? []).some(
      (output) => output.type === 'tool.execution' && output.name === 'web_search',
    ),
    usage: result.usage ?? {},
    totalTokens: result.usage?.total_tokens ?? 0,
  }
}
