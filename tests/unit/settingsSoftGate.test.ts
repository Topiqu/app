import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Basic settings soft gate', () => {
  const settings = source('app/pages/settings/index.vue')
  const aiForm = source('app/components/Form/Client/AI.vue')
  const patch = source('server/api/clients/[id]/index.patch.ts')

  it('keeps content and AI configuration editable on Basic', () => {
    expect(settings).toContain('<LazyFormClientContent')
    expect(settings).not.toMatch(/<LazyFormClientContent\s+v-if="!isBasic"/)
    expect(settings).toContain(':setupOnly="isBasic"')
    expect(settings).toContain('aiUser: form.value.aiUser')
  })

  it('locks paid feature activation without disabling preparatory AI settings', () => {
    expect(aiForm).toMatch(/v-if="!setupOnly"[\s\S]*<FormClientFeatureToggle/)
    expect(aiForm).toContain("!aiEnabled && !setupOnly && 'opacity-60 pointer-events-none'")
  })

  it('persists the AI identity independently of the token allowance', () => {
    expect(patch).toContain('if (hasAiPayload)')
    expect(patch).not.toContain('effectiveTokenLimit')
    expect(patch).not.toContain('AI_USER_DELETE')
  })
})
