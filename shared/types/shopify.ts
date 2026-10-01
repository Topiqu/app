export interface ShopifyBlog {
  id: string
  title: string
  handle: string
}

export interface ShopifyCollectionInsight {
  id: string
  title: string
  description: string
  products: number
  available: number
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
  billingProvider: 'STRIPE' | 'SHOPIFY'
  pricingUrl: string | null
  adminUrl: string | null
  installUrl: string | null
  pending: null | {
    shop: string
    shopName: string
    project: string
    shopifyBilling: boolean
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
