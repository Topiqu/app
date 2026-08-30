import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { zodSchema } from '@ai-sdk/provider-utils'

import { topicSchema } from '../../../server/utils/ai/topic'
import { articleSchema } from '../../../server/utils/ai/article'
import { insightSchema } from '../../../server/utils/ai/insight'
import { translationSchema } from '../../../server/utils/ai/translate'

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
