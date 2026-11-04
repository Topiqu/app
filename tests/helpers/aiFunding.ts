import { vi } from 'vitest'

/** Ownership/recovery fixtures mock the provider itself; funding has separate real-DB tests. */
export const stubAiFunding = () => {
  vi.stubGlobal('withAiSpend', <T>(_site: string, run: () => T) => run())
  vi.stubGlobal('withAiAllowance', <T>(_site: string, _kind: string, run: () => T) => run())
}
