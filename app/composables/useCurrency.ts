// A ref, not a number: a snapshot taken before the fetch settles freezes the USD default into the page.
export const useCurrencyRate = (target: MaybeRefOrGetter<string | null | undefined>) => {
  const code = computed(() => (toValue(target) || 'USD').toUpperCase())
  const { data } = useFetch('/api/currency', {
    query: { target: code },
    key: computed(() => `rate-${code.value}`),
    default: () => ({ rate: 1 }),
  })
  return computed(() => data.value.rate)
}
