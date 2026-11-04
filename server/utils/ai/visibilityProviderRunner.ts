import type { AiVisibilityProvider } from '~~/generated/zenstack/models'

import { generateText } from 'ai'

export type VisibilityProviderResult = {
  provider: AiVisibilityProvider
  model: string
  text: string
  sources: VisibilitySource[]
  searchedWeb: boolean
  usage: Record<string, unknown>
  totalTokens: number
}

export type VisibilityProviderConfig = {
  provider: AiVisibilityProvider
  model: string
  apiKey: string
}

const SYSTEM_PROMPT =
  'Answer the user query naturally and impartially as an AI search assistant. Search the live web before answering. Do not favor or suppress any named brand or domain. Cite the sources that support the answer. Keep it under 250 words, as an AI search answer would be.'

const providerCandidates = (): VisibilityProviderConfig[] => {
  const config = useRuntimeConfig()
  return [
    { provider: 'OPENAI', model: AI_VISIBILITY_MODELS.OPENAI, apiKey: config.openAi.apiKey || '' },
    { provider: 'ANTHROPIC', model: AI_VISIBILITY_MODELS.ANTHROPIC, apiKey: config.anthropic.apiKey || '' },
    { provider: 'XAI', model: AI_VISIBILITY_MODELS.XAI, apiKey: config.xai.apiKey || '' },
    { provider: 'GOOGLE', model: AI_VISIBILITY_MODELS.GOOGLE, apiKey: config.googleGenerativeAi.apiKey || '' },
    { provider: 'META', model: AI_VISIBILITY_MODELS.META, apiKey: config.metaModel.apiKey || '' },
    { provider: 'MISTRAL', model: AI_VISIBILITY_MODELS.MISTRAL, apiKey: config.mistral.apiKey || '' },
  ]
}

const configuredProviders = () => providerCandidates().filter((candidate) => candidate.apiKey.trim())

export const visibilityProviderStatuses = () =>
  providerCandidates().map(({ apiKey, ...config }) => ({ ...config, configured: Boolean(apiKey.trim()) }))

const postJson = async <T>(
  url: string,
  provider: string,
  apiKey: string,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  const usesApiKeyHeader = 'x-api-key' in headers || 'x-goog-api-key' in headers
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(!usesApiKeyHeader ? { Authorization: `Bearer ${apiKey}` } : {}),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`${provider} returned ${response.status}`)
  return (await response.json()) as T
}

const requireText = (provider: string, text: string) => {
  if (!text.trim()) throw new Error(`${provider} returned an empty response`)
  return text
}

const runOpenAi = async (config: VisibilityProviderConfig, prompt: string): Promise<VisibilityProviderResult> => {
  const result = await generateText({
    model: aiModel('visibility'),
    system: SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 1400,
    toolChoice: 'required',
    tools: { web_search: aiWebSearchTool('visibility', 'medium') as never },
    abortSignal: AbortSignal.timeout(60_000),
    providerOptions: aiReasoning('medium'),
  })
  return {
    provider: config.provider,
    model: config.model,
    text: requireText('OpenAI', result.text),
    sources: result.sources.flatMap((source) =>
      source.sourceType === 'url'
        ? [{ sourceType: 'url' as const, url: source.url, ...(source.title ? { title: source.title } : {}) }]
        : [],
    ),
    searchedWeb: result.toolResults.some((tool) => tool.toolName === 'web_search'),
    usage: JSON.parse(JSON.stringify(result.usage ?? {})),
    totalTokens: result.usage.totalTokens ?? 0,
  }
}

const runAnthropic = async (config: VisibilityProviderConfig, prompt: string): Promise<VisibilityProviderResult> => {
  const result = await postJson<AnthropicResponse>(
    'https://api.anthropic.com/v1/messages',
    'Anthropic',
    config.apiKey,
    {
      model: config.model,
      // Haiku thinks out of the same pool; 1400 is the answer's share.
      max_tokens: 1400 + 8000,
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    },
    { 'anthropic-version': '2023-06-01', 'x-api-key': config.apiKey },
  )
  const parsed = parseAnthropicResult(result)
  return { provider: config.provider, model: config.model, ...parsed, text: requireText('Anthropic', parsed.text) }
}

const runResponsesProvider = async (
  config: VisibilityProviderConfig,
  prompt: string,
  provider: string,
  url: string,
): Promise<VisibilityProviderResult> => {
  const result = await postJson<ResponsesApiResponse>(url, provider, config.apiKey, {
    model: config.model,
    instructions: SYSTEM_PROMPT,
    input: prompt,
    max_output_tokens: 1400,
    tools: [
      provider === 'Meta Model API' ? { type: 'web_search', search_context_size: 'medium' } : { type: 'web_search' },
    ],
  })
  const parsed = parseResponsesApiResult(result)
  return { provider: config.provider, model: config.model, ...parsed, text: requireText(provider, parsed.text) }
}

const runGoogle = async (config: VisibilityProviderConfig, prompt: string): Promise<VisibilityProviderResult> => {
  const result = await postJson<GoogleResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    'Google Gemini',
    config.apiKey,
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 1400 },
    },
    { 'x-goog-api-key': config.apiKey },
  )
  const parsed = parseGoogleResult(result)
  return { provider: config.provider, model: config.model, ...parsed, text: requireText('Google Gemini', parsed.text) }
}

const runMistral = async (config: VisibilityProviderConfig, prompt: string): Promise<VisibilityProviderResult> => {
  const result = await postJson<MistralResponse>('https://api.mistral.ai/v1/conversations', 'Mistral', config.apiKey, {
    model: config.model,
    inputs: prompt,
    instructions: SYSTEM_PROMPT,
    tools: [{ type: 'web_search' }],
    completion_args: { max_tokens: 1400 },
    store: false,
  })
  const parsed = parseMistralResult(result)
  return { provider: config.provider, model: config.model, ...parsed, text: requireText('Mistral', parsed.text) }
}

const runProvider = (config: VisibilityProviderConfig, prompt: string) => {
  switch (config.provider) {
    case 'OPENAI':
      return runOpenAi(config, prompt)
    case 'ANTHROPIC':
      return runAnthropic(config, prompt)
    case 'XAI':
      return runResponsesProvider(config, prompt, 'xAI', 'https://api.x.ai/v1/responses')
    case 'GOOGLE':
      return runGoogle(config, prompt)
    case 'META':
      return runResponsesProvider(config, prompt, 'Meta Model API', 'https://api.meta.ai/v1/responses')
    case 'MISTRAL':
      return runMistral(config, prompt)
  }
}

/** Providers without a verified itemized price retain the conservative per-response reservation.
 * This is explicitly an estimate, never reported as the provider's billed cost. */
export const visibilityCostMicros = (result: VisibilityProviderResult): number | null => {
  const usage = result.usage
  if (result.provider === 'XAI' && typeof usage.cost_usd === 'number' && usage.cost_usd >= 0)
    return Math.ceil(usage.cost_usd * 1_000_000)
  if (result.provider === 'ANTHROPIC') {
    const input = usage.input_tokens
    const output = usage.output_tokens
    const search = usage.server_tool_use as { web_search_requests?: number } | undefined
    if (typeof input === 'number' && typeof output === 'number' && typeof search?.web_search_requests === 'number')
      return aiTextCostMicros(result.model, input, output) + search.web_search_requests * 10_000
  }
  if (result.provider === 'GOOGLE') {
    const input = usage.promptTokenCount
    const output = usage.candidatesTokenCount
    const thinking = usage.thoughtsTokenCount ?? 0
    if (
      typeof input === 'number' &&
      typeof output === 'number' &&
      typeof thinking === 'number' &&
      typeof usage.searchQueries === 'number'
    ) {
      // Standard rates after the introductory promotion; do not assume a free account-wide search pool.
      return Math.ceil(input * 1.5 + (output + thinking) * 7.5 + usage.searchQueries * 14_000)
    }
  }
  return null
}

export const runVisibilityProvider = async (
  config: VisibilityProviderConfig,
  prompt: string,
  clientSiteId?: string,
) => {
  // OpenAI already passes through the funded AI SDK middleware.
  if (config.provider === 'OPENAI') return runProvider(config, prompt)
  const reservation = await reserveAiAllowance(aiSpendSiteId(clientSiteId), 'BUDGET', 500_000, {
    task: 'visibility',
    provider: config.provider,
    model: config.model,
    maximumEstimated: true,
    priceVersion: AI_PRICE_VERSION,
  })
  let result: VisibilityProviderResult
  try {
    result = await runProvider(config, prompt)
  } catch (error) {
    await settleAiAllowance(reservation, null).catch((failure) =>
      reportCaughtError('Visibility spend settlement failed', failure, { clientSiteId }),
    )
    throw error
  }
  const cost = visibilityCostMicros(result)
  await settleAiAllowance(reservation, cost).catch((error) =>
    reportCaughtError('Visibility spend settlement failed', error, { clientSiteId }),
  )
  return {
    ...result,
    usage: {
      ...result.usage,
      topiquCost: { micros: cost ?? reservation.reserved, estimated: cost === null, priceVersion: AI_PRICE_VERSION },
    },
  }
}

export const configuredVisibilityProviderRuns = () => configuredProviders()
