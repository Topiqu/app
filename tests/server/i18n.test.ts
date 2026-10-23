import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const setup = async () => {
  const storage = {
    getKeys: vi.fn(async () => ['en:common.json']),
    getItem: vi.fn(async () => ({ common: { greeting: 'Hello {name}', count: 7, group: { label: 'Grouped' } } })),
  }
  vi.stubGlobal('useStorage', () => storage)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  return { storage, ...(await import('../../server/utils/i18n')) }
}

describe('server translation loading', () => {
  it('normalizes arbitrary cookie locales instead of growing a permanent cache for each string', async () => {
    const { storage, getServerTranslator } = await setup()
    for (let index = 0; index < 100; index++) {
      const t = await getServerTranslator(`unknown-${index}`)
      expect(t('common.greeting', { name: 'Reader' })).toBe('Hello Reader')
    }
    expect(storage.getKeys).toHaveBeenCalledTimes(1)
  })

  it('coalesces concurrent loads of the same bundled locale', async () => {
    const { storage, getServerTranslator } = await setup()
    const translators = await Promise.all(Array.from({ length: 20 }, () => getServerTranslator('en')))
    expect(translators.every((t) => t('common.group.label') === 'Grouped')).toBe(true)
    expect(storage.getKeys).toHaveBeenCalledTimes(1)
    expect(storage.getItem).toHaveBeenCalledTimes(1)
  })

  it('treats non-string and missing messages as missing translations', async () => {
    const { getServerTranslator } = await setup()
    const t = await getServerTranslator('en')
    expect(t('common.count')).toBeUndefined()
    expect(t('common.group')).toBeUndefined()
    expect(t('common.missing')).toBeUndefined()
    expect(t('__proto__.toString')).toBeUndefined()
  })

  it('allows a failed asset load to be retried', async () => {
    const { storage, getServerTranslator } = await setup()
    storage.getKeys.mockRejectedValueOnce(new Error('Temporary bundled storage error'))
    await expect(getServerTranslator('en')).rejects.toThrow('Temporary bundled storage error')
    expect((await getServerTranslator('en'))('common.group.label')).toBe('Grouped')
    expect(storage.getKeys).toHaveBeenCalledTimes(2)
  })

  it('retains explicit messages and zero-valued interpolation parameters', async () => {
    const { storage, getServerTranslator } = await setup()
    const t = await getServerTranslator('cs', { value: 'Počet: {count}; {missing}', positional: 'Počet: {0}' })
    expect(t('value', { count: 0 })).toBe('Počet: 0; {missing}')
    expect(t('positional', [0])).toBe('Počet: 0')
    expect(storage.getKeys).not.toHaveBeenCalled()
  })
})
