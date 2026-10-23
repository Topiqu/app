import type { Ref } from 'vue'

type TagOption = { id: string; name: string }
type ArticleTagRow = { tagId: string; tag: TagOption }
type RequestFetch = ReturnType<typeof useRequestFetch>

const emptyTags = () => []
const tagListQuery =
  (requestFetch: RequestFetch) =>
  ({ signal }: { signal: AbortSignal }) =>
    requestFetch<TagOption[]>('/api/tags', { signal })
const articleTagsQuery =
  (requestFetch: RequestFetch, articleId: string) =>
  ({ signal }: { signal: AbortSignal }) =>
    requestFetch<ArticleTagRow[], '/api/articles/:id/tags'>(
      `/api/articles/${articleId}/tags` as '/api/articles/:id/tags',
      { signal },
    )

// Colada retains options until cache GC. Keep those callbacks outside component
// setup scopes so cached tags cannot keep an unmounted editor alive.
export const useTagQueries = (
  article: Readonly<Ref<{ id: string } | undefined>>,
  initialTags: Readonly<Ref<string[] | undefined>>,
) => {
  const requestFetch = useRequestFetch()
  const allTags = useQuery({
    key: queryKeys.tags.list,
    query: tagListQuery(requestFetch),
    placeholderData: emptyTags,
  })
  const articleTags = useQuery(() => {
    const articleId = article.value?.id ?? ''
    return {
      key: queryKeys.articles.tags(articleId),
      query: articleTagsQuery(requestFetch, articleId),
      enabled: !!articleId && initialTags.value === undefined,
      placeholderData: emptyTags,
    }
  })
  return { allTags, articleTags }
}
