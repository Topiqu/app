const currencyCode = (value: string | null | undefined) => (value || 'USD').toUpperCase()
const defaultRate = () => ({ rate: 1 })
// Nuxt retains options after unmount. Only a primitive snapshot may cross that boundary.
const currencyOptions = (code: Ref<string>) => ({
  query: { target: code },
  key: computed(() => `rate-${code.value}`),
  default: defaultRate,
  $fetch: useRequestFetch(),
})

// A ref, not a number: pending data must not freeze the fallback into the page.
export const useCurrencyRate = (target: MaybeRefOrGetter<string | null | undefined>) => {
  const code = shallowRef(currencyCode(toValue(target)))
  watch(
    () => toValue(target),
    (value) => (code.value = currencyCode(value)),
    { flush: 'sync' },
  )
  const { data } = useFetch('/api/currency', currencyOptions(code))
  return computed(() => data.value.rate)
}
