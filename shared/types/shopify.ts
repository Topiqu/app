export interface ShopifyBlog {
  id: string
  title: string
  handle: string
}

export interface ShopifyStatus {
  configured: boolean
  eligible: boolean
  canManage: boolean
  canPublish: boolean
  connection: null | {
    shop: string
    shopName: string
    blogId: string | null
    blogTitle: string | null
    author: string | null
    status: 'CONNECTED' | 'REAUTH_REQUIRED' | 'REVOKED'
  }
}

export interface ShopifyPublication {
  id: string
  status: 'QUEUED' | 'PUBLISHING' | 'SYNCED' | 'FAILED' | 'UNCERTAIN'
  shopifyArticleId: string | null
  url: string | null
  isPublished: boolean
  lastSyncedAt: string | null
  lastError: string | null
}
