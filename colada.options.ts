import type { PiniaColadaOptions } from '@pinia/colada'

export default {
  queryOptions: {
    staleTime: 1000 * 300,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
} satisfies PiniaColadaOptions
