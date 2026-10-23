import type { Ref } from 'vue'

import { createAsyncDataDefault } from '~/utils/asyncDataDefaults'

const emptyUsers = createAsyncDataDefault({ data: [], total: 0 })

// Callers pass plain value refs, so cached URL callbacks cannot retain a modal setup getter.
export const useUserSearch = (page: Readonly<Ref<number>>, search: Readonly<Ref<string>>) =>
  useFetch(() => `/api/users?page=${page.value}&query=${search.value}`, {
    default: emptyUsers,
    $fetch: useRequestFetch(),
    immediate: false,
    watch: false,
  })
