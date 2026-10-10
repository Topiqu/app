import { describe, expect, it } from 'vitest'

import { imageExtension } from '../../server/utils/ai/image'
import {
  AI_IMAGE_MODELS,
  AI_MODELS,
  AI_VISIBILITY_MODELS,
  aiImageModelId,
  aiImageModelProvider,
  aiModelId,
  aiModelProvider,
} from '../../server/utils/ai/modelRegistry'

const ALL_ENTRIES = [...Object.entries(AI_MODELS), ...Object.entries(AI_IMAGE_MODELS)]
const ACTIVE_MODEL_IDS = [
  ...ALL_ENTRIES.map(([task, { id }]) => [task, id] as const),
  ...Object.entries(AI_VISIBILITY_MODELS),
]

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
    for (const [task, id] of ACTIVE_MODEL_IDS) {
      expect(RETIRED_MODEL_IDS, `task "${task}" uses retired model "${id}"`).not.toContain(id)
    }
  })

  it('never points a task at a model Google is retiring on 2026-08-17', () => {
    for (const [task, id] of ACTIVE_MODEL_IDS) {
      for (const pattern of RETIRED_MODEL_PATTERNS) {
        expect(pattern.test(id), `task "${task}" uses retired model "${id}"`).toBe(false)
      }
    }
  })

  it('declares a known provider and a non-empty id for every task', () => {
    for (const [task, { provider, id }] of ALL_ENTRIES) {
      expect(['openai', 'anthropic'], `task "${task}"`).toContain(provider)
      expect(id.trim(), `task "${task}"`).not.toBe('')
    }
  })

  it('runs every text task on Claude Haiku 5.5 except the ChatGPT visibility probe', () => {
    for (const [task, { provider, id }] of Object.entries(AI_MODELS)) {
      if (task === 'visibility') continue
      expect(provider, task).toBe('anthropic')
      expect(id, task).toBe('claude-haiku-5-5')
    }
  })

  it('measures ChatGPT visibility with an OpenAI model', () => {
    expect(aiModelProvider('visibility')).toBe('openai')
    expect(AI_VISIBILITY_MODELS.OPENAI).toBe(aiModelId('visibility'))
    expect(aiModelId('visibility')).toMatch(/^gpt-/)
  })

  it('measures Claude visibility with Haiku, not a costlier tier', () => {
    expect(AI_VISIBILITY_MODELS.ANTHROPIC).toBe('claude-haiku-5-5')
  })

  it('generates article images with an OpenAI image model', () => {
    expect(aiImageModelProvider('articleImage')).toBe('openai')
    expect(aiImageModelId('articleImage')).toMatch(/^gpt-image-/)
    expect(aiImageModelId('articleImage')).toBe('gpt-image-2.5-flare')
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
