export const useCurrencyRate = async (target: string) => {
  if (target.toUpperCase() === 'CZK') return 1

  const { data } = await useFetch('/api/currency', {
    method: 'POST',
    body: { target: target.toUpperCase() },
    key: `rate-${target.toUpperCase()}`,
    default: () => ({ rate: 1 }),
    server: false,
  })

  return data.value?.rate ?? 1
}
