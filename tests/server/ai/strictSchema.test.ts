import { z } from 'zod'
import { zodSchema } from '@ai-sdk/provider-utils'
import { describe, expect, it, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/aiUsage'), 'recordAiUsage')
  await stubNitroImports(import('../../../server/utils/ai/articleUsage'), 'withArticleUsageStage')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(
    import('../../../server/utils/ai/formats'),
    'allowedModulesFor',
    'ARTICLE_FORMAT_NAMES',
    'ARTICLE_MODULE_NAMES',
    'ARTICLE_STRUCTURE_VARIANTS',
    'formatMenu',
    'isStructureVariantFor',
    'formatRules',
    'selectedModulesFor',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/researchEvidence'),
    'researchTopic',
    'extractResearchUrls',
    'researchEvidence',
    'retrievedResearchSources',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/editorialPolicy'),
    'editorialPolicy',
    'AUTHORIAL_REASONING',
    'ILLUSTRATIVE_STORY',
  )
  await stubNitroImports(import('../../../server/utils/ai/insight'), 'insightSchema')
  await stubNitroImports(import('../../../server/utils/planFeatures'), 'activeFeatureFilter')
  await stubNitroImports(import('../../../server/utils/community'), 'readCommunityInsight')
  await stubNitroImports(import('../../../server/utils/ai/articleQuality'), 'AUTHOR_ACCOUNT_RULE')
  await stubNitroImports(import('../../../server/utils/knowledge/retrieve'), 'retrieveKnowledge')
  await stubNitroImports(import('../../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../../server/utils/articleGenerationAudit'), 'auditArticleStep')
  await stubNitroImports(import('../../../server/utils/sanitize'), 'escapeHtml')
}

await stubImports()

const { topicSchema } = await import('../../../server/utils/ai/topic')
const { insightSchema } = await import('../../../server/utils/ai/insight')
const { articleSchema } = await import('../../../server/utils/ai/articleConfig')
const { translationSchema } = await import('../../../server/utils/ai/translate')
const { articleSeriesDecisionSchema } = await import('../../../server/utils/ai/articleSeries')

type JsonSchemaNode = {
  type?: string
  properties?: Record<string, JsonSchemaNode>
  required?: string[]
  additionalProperties?: boolean
  format?: string
  items?: JsonSchemaNode
  anyOf?: JsonSchemaNode[]
  oneOf?: JsonSchemaNode[]
  allOf?: JsonSchemaNode[]
}

const collectStrictViolations = (node: JsonSchemaNode, path = '(root)', out: string[] = []) => {
  if (node.type === 'object' && node.properties) {
    const keys = Object.keys(node.properties)
    const required = node.required ?? []
    const missing = keys.filter((key) => !required.includes(key))

    if (missing.length) out.push(`${path}: not in "required" — ${missing.join(', ')}`)
    if (node.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`)

    for (const key of keys) collectStrictViolations(node.properties[key]!, `${path}.${key}`, out)
  }

  if (node.items) collectStrictViolations(node.items, `${path}[]`, out)

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    node[key]?.forEach((branch, i) => collectStrictViolations(branch, `${path}.${key}[${i}]`, out))
  }

  return out
}

const collectFormats = (node: JsonSchemaNode, out: string[] = []) => {
  if (node.format) out.push(node.format)
  Object.values(node.properties ?? {}).forEach((child) => collectFormats(child, out))
  if (node.items) collectFormats(node.items, out)
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) node[key]?.forEach((branch) => collectFormats(branch, out))
  return out
}

describe('OpenAI strict structured-output compatibility', () => {
  it.each([
    ['articleSchema', articleSchema],
    ['translationSchema', translationSchema],
    ['insightSchema', insightSchema],
    ['topicSchema', topicSchema],
    ['articleSeriesDecisionSchema', articleSeriesDecisionSchema],
  ])('%s converts to a strict-safe JSON schema', (_name, schema) => {
    const jsonSchema = zodSchema(schema).jsonSchema as JsonSchemaNode

    expect(collectStrictViolations(jsonSchema)).toEqual([])
  })

  it('flags an optional field, which OpenAI rejects with strict: true', () => {
    const violations = collectStrictViolations(
      zodSchema(z.object({ a: z.string(), b: z.string().optional() })).jsonSchema as JsonSchemaNode,
    )

    expect(violations).toEqual(['(root): not in "required" — b'])
  })

  it('does not emit unsupported string formats in the article response schema', () => {
    const jsonSchema = zodSchema(articleSchema).jsonSchema as JsonSchemaNode

    expect(collectFormats(jsonSchema)).toEqual([])
  })
})

beforeEach(stubImports)
