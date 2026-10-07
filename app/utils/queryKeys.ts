export const queryKeys = {
  authors: {
    detail: (userId: string) => ['authors', userId] as const,
  },
  articles: {
    all: ['articles'] as const,
    lists: ['articles', 'list'] as const,
    list: (page: number, query: string) => ['articles', 'list', { page, query }] as const,
    detail: (articleId: string) => ['articles', 'detail', articleId] as const,
    tags: (articleId: string) => ['articles', 'detail', articleId, 'tags'] as const,
    availableTags: (articleId: string) => ['articles', 'detail', articleId, 'available-tags'] as const,
  },
  tags: {
    all: ['tags'] as const,
    list: ['tags', 'list'] as const,
  },
  clients: {
    all: ['clients'] as const,
    lists: ['clients', 'list'] as const,
    list: (page: number, query: string) => ['clients', 'list', { page, query }] as const,
  },
  stats: {
    all: ['stats'] as const,
    dashboard: ['stats', 'dashboard'] as const,
    sentiment: ['stats', 'sentiment'] as const,
  },
  visibility: {
    all: ['visibility'] as const,
    overview: ['visibility', 'overview'] as const,
  },
  webhooks: {
    all: ['webhooks'] as const,
  },
  domain: {
    status: ['domain'] as const,
  },
  keywordPlan: {
    list: ['keyword-plan'] as const,
  },
  contentActions: {
    list: ['content-actions'] as const,
  },
  backlinks: {
    list: ['backlinks'] as const,
  },
} as const
