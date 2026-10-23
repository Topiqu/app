import { vi } from 'vitest'

export async function stubNitroImports<T extends Record<string, unknown>>(
  pending: Promise<T>,
  ...names: (keyof T & string)[]
) {
  const exports = await pending
  for (const name of names) vi.stubGlobal(name, exports[name])
}
