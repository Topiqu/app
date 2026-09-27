// `createError` messages arrive on the FetchError's `data`; `error.message` is only the transport summary.
export const fetchErrorMessage = (error: unknown, fallback: string) =>
  (error as { data?: { message?: string } } | null | undefined)?.data?.message || fallback
