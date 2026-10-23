// Nuxt retains default factories after unmount. A module callback avoids keeping
// the caller's setup scope alive and still gives every reset its own mutable array.
export const emptyAsyncDataList = (): never[] => []

/** Only plain, serializable initial data belongs here, without refs or callbacks. */
export function createAsyncDataDefault<T>(initial: T) {
  return () => structuredClone(initial)
}
