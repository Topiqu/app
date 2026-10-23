import { describe, expect, it } from 'vitest'

import { createAsyncDataDefault } from '../../app/utils/asyncDataDefaults'

describe('retained async-data defaults', () => {
  it('keeps independent resets isolated without changing the original seed or nested arrays', () => {
    const seed = { items: [] as { id: string }[], pricing: { month: null as number | null } }
    const reset = createAsyncDataDefault(seed)
    const first = reset()
    first.items.push({ id: 'unsaved' })
    first.pricing.month = 20
    expect(reset()).toEqual({ items: [], pricing: { month: null } })
    expect(seed).toEqual({ items: [], pricing: { month: null } })
  })
})
