export const useShopify = () => {
  const { data: auth } = useAuth()
  return useFetch<ShopifyStatus>('/api/shopify/status', {
    key: `shopify-status-${auth.value?.user.clientSiteId}`,
    server: false,
  })
}
