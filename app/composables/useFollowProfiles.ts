export const useFollowProfiles = (type: Readonly<Ref<'followers' | 'followed'>>) => {
  // The caller passes a property ref, never a getter or defineModel ref owning a component.
  const path = computed(() => `/api/follows/${type.value}` as const)
  return useFetch(path, {
    key: computed(() => `follow-profiles:${type.value}`),
    $fetch: useRequestFetch(),
  })
}
