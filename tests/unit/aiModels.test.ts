import { describe, expect, it } from 'vitest'

import { imageExtension } from '../../server/utils/ai/image'
import {
  AI_IMAGE_MODELS,
  AI_MODELS,
  aiImageModelId,
  aiImageModelProvider,
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
  'grok-4.3',
  'grok-3',
  'grok-code-fast-1',
  'grok-imagine-image-pro',
  'grok-2-image',
]

const RETIRED_MODEL_PATTERNS = [/^imagen-/]

describe('AI model registry', () => {
  it('never points a task at a retired xAI model', () => {
    for (const [task, { id }] of ALL_ENTRIES) {
      expect(RETIRED_MODEL_IDS, `task "${task}" uses retired model "${id}"`).not.toContain(id)
    }
  })

  it('never points a task at a model Google is retiring on 2026-08-17', () => {
    for (const [task, { id }] of ALL_ENTRIES) {
      for (const pattern of RETIRED_MODEL_PATTERNS) {
        expect(pattern.test(id), `task "${task}" uses retired model "${id}"`).toBe(false)
      }
    }
  })

  it('declares a known provider and a non-empty id for every task', () => {
    for (const [task, { provider, id }] of ALL_ENTRIES) {
      expect(['openai'], `task "${task}"`).toContain(provider)
      expect(id.trim(), `task "${task}"`).not.toBe('')
    }
  })

  it('routes every task through OpenAI so only OPENAI_API_KEY is required at runtime', () => {
    for (const [task, { provider }] of ALL_ENTRIES) {
      expect(provider, `task "${task}"`).toBe('openai')
    }
  })

  it('researches with a text model, not an image model', () => {
    expect(aiModelProvider('articleResearch')).toBe('openai')
    expect(aiModelId('articleResearch')).toBe('gpt-5.6-luna')
    expect(aiModelId('articleResearch')).not.toMatch(/^gpt-image-/)
  })

  it('generates article images with an OpenAI image model', () => {
    expect(aiImageModelProvider('articleImage')).toBe('openai')
    expect(aiImageModelId('articleImage')).toMatch(/^gpt-image-/)
    expect(aiImageModelId('articleImage')).toBe('gpt-image-2')
  })

  it('keeps the token-heavy translation task on a low-cost tier', () => {
    expect(aiModelProvider('translation')).toBe('openai')
    expect(aiModelId('translation')).toBe('gpt-5.6-luna')
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
