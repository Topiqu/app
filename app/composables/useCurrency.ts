export const useCurrencyRate = async (target: string) => {
  const code = (target || 'USD').toUpperCase()
  if (code === 'USD') return 1

  const { data } = await useFetch('/api/currency', {
    method: 'POST',
    body: { target: code },
    key: `rate-${code}`,
    default: () => ({ rate: 1 }),
    server: false,
  })

  return data.value?.rate ?? 1
}
