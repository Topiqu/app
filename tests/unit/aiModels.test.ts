import { describe, expect, it } from 'vitest'

import { imageExtension } from '../../server/utils/ai/image'
import {
  AI_IMAGE_MODELS,
  AI_MODELS,
  aiImageModelId,
  aiModelId,
  aiModelProvider,
} from '../../server/utils/ai/modelRegistry'

const ALL_ENTRIES = [...Object.entries(AI_MODELS), ...Object.entries(AI_IMAGE_MODELS)]

const RETIRED_MODEL_IDS = [
  'grok-4-1-fast',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-4-fast-reasoning',
  'grok-4-fast-non-reasoning',
  'grok-4-0709',
  'grok-3',
  'grok-code-fast-1',
  'grok-imagine-image-pro',
  'grok-2-image',
]

describe('AI model registry', () => {
  it('never points a task at a model xAI retired on 2026-05-15', () => {
    for (const [task, { id }] of ALL_ENTRIES) {
      expect(RETIRED_MODEL_IDS, `task "${task}" uses retired model "${id}"`).not.toContain(id)
    }
  })

  it('declares a known provider and a non-empty id for every task', () => {
    for (const [task, { provider, id }] of ALL_ENTRIES) {
      expect(['xai', 'google'], `task "${task}"`).toContain(provider)
      expect(id.trim(), `task "${task}"`).not.toBe('')
    }
  })

  it('keeps research on xAI so live search grounding stays available', () => {
    expect(aiModelProvider('articleResearch')).toBe('xai')
    expect(aiModelId('articleResearch')).toBe('grok-4.3')
  })

  it('writes articles on a different model than it researches with', () => {
    expect(aiModelId('articleWriter')).not.toBe(aiModelId('articleResearch'))
    expect(aiModelProvider('articleWriter')).toBe('google')
  })

  it('generates article images with Imagen 4', () => {
    expect(aiImageModelId('articleImage')).toMatch(/^imagen-4\./)
  })

  it('keeps the token-heavy translation task on the cheapest provider', () => {
    expect(aiModelProvider('translation')).toBe('xai')
  })
})

describe('imageExtension', () => {
  it('maps the media types image providers actually return', () => {
    expect(imageExtension('image/png')).toBe('png')
    expect(imageExtension('image/jpeg')).toBe('jpg')
    expect(imageExtension('image/webp')).toBe('webp')
  })

  it('normalises casing and surrounding whitespace', () => {
    expect(imageExtension(' IMAGE/PNG ')).toBe('png')
  })

  it('falls back to png for an unknown media type instead of mislabelling the file', () => {
    expect(imageExtension('application/octet-stream')).toBe('png')
    expect(imageExtension('')).toBe('png')
  })
})
