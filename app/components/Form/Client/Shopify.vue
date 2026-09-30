<script setup lang="ts">
import type { ShopifyBlog } from '~~/shared/types/shopify'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()
const { data, status, error, refresh } = await useShopify()
const installedShop = useCookie<string | null>(SHOPIFY_INSTALL_COOKIE)
const shop = shallowRef('')
const blogId = shallowRef('')
const author = shallowRef('')
const blogs = shallowRef<ShopifyBlog[]>([])
const busy = shallowRef(false)
const blogsError = shallowRef(false)
const connected = computed(() => data.value?.connection?.status === 'CONNECTED')
const blogItems = computed(() => blogs.value.map((blog) => ({ label: blog.title, value: blog.id })))
const notice = computed(() => (typeof route.query.shopify === 'string' ? route.query.shopify : ''))
const noticeKey = computed(() => (['connected', 'cancelled', 'error'].includes(notice.value) ? notice.value : ''))

const loadBlogs = async () => {
  blogsError.value = false
  try {
    blogs.value = await $fetch<ShopifyBlog[]>('/api/shopify/blogs')
  } catch {
    blogsError.value = true
  }
}
watch(
  () => data.value?.connection,
  (connection) => {
    shop.value = connection?.shop || installedShop.value || ''
    blogId.value = connection?.blogId || ''
    author.value = connection?.author || 'Topiqu'
    if (connection?.status === 'CONNECTED') void loadBlogs()
  },
  { immediate: true },
)

const action = async (run: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true
  try {
    await run()
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.shopify.actionFailed')) })
  } finally {
    busy.value = false
  }
}
const connect = () =>
  action(async () => {
    const result = await $fetch<{ url: string }>('/api/shopify/connect', { method: 'POST', body: { shop: shop.value } })
    window.location.assign(result.url)
  })
const save = () =>
  action(async () => {
    await $fetch('/api/shopify/settings', { method: 'PATCH', body: { blogId: blogId.value, author: author.value } })
    await refresh()
    toast.add({ color: 'success', title: t('common.messages.saveSuccess') })
  })
const disconnect = async () => {
  if (
    !(await confirm({
      title: t('common.shopify.disconnect'),
      message: t('common.shopify.disconnectDescription'),
      variant: 'danger',
    }))
  )
    return
  await action(async () => {
    await $fetch('/api/shopify', { method: 'DELETE' })
    await refresh()
  })
}
</script>

<template>
  <section class="space-y-4" data-shopify-settings>
    <p class="text-sm text-muted">{{ $t('common.shopify.description') }}</p>
    <UProgress v-if="status === 'pending'" :aria-label="$t('common.loading')" />
    <UAlert v-else-if="error" color="error" :title="$t('common.shopify.actionFailed')">
      <template #actions
        ><UButton color="neutral" variant="soft" @click="refresh()">{{ $t('common.shopify.retry') }}</UButton></template
      >
    </UAlert>
    <template v-else-if="data">
      <UAlert
        v-if="noticeKey"
        :color="noticeKey === 'connected' ? 'success' : 'warning'"
        :title="$t(`common.shopify.callback.${noticeKey}`)"
      />
      <UAlert v-if="!data.configured" color="warning" :title="$t('common.shopify.notConfigured')" />
      <UAlert v-else-if="!data.eligible" color="warning" :title="$t('common.shopify.requiresPlan')" />
      <template v-else>
        <div
          v-if="data.connection"
          class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-highlighted">{{ data.connection.shopName }}</p>
            <p class="truncate text-xs text-muted">{{ data.connection.shop }}</p>
          </div>
          <UBadge :color="connected ? 'success' : 'warning'" variant="soft">{{
            $t(`common.shopify.connection.${data.connection.status}`)
          }}</UBadge>
        </div>
        <template v-if="!connected">
          <UFormField :label="$t('common.shopify.shop')" :description="$t('common.shopify.shopHelp')">
            <UInput
              v-model="shop"
              class="w-full"
              placeholder="your-store.myshopify.com"
              :disabled="busy || Boolean(data.connection)"
            />
          </UFormField>
          <UButton icon="mdi:shopify" :loading="busy" :disabled="!shop.trim() || !data.canManage" @click="connect">
            {{ $t(data.connection ? 'common.shopify.reconnect' : 'common.shopify.connect') }}
          </UButton>
        </template>
        <template v-else>
          <UAlert v-if="blogsError" color="warning" :title="$t('common.shopify.blogsFailed')">
            <template #actions
              ><UButton color="neutral" variant="soft" @click="loadBlogs">{{
                $t('common.shopify.retry')
              }}</UButton></template
            >
          </UAlert>
          <UFormField :label="$t('common.shopify.blog')">
            <USelect
              v-model="blogId"
              class="w-full"
              :items="blogItems"
              :placeholder="$t('common.shopify.chooseBlog')"
              :disabled="busy"
            />
          </UFormField>
          <UFormField :label="$t('common.shopify.author')">
            <UInput v-model="author" class="w-full" :maxlength="255" :disabled="busy" />
          </UFormField>
          <p class="text-xs text-muted">{{ $t('common.shopify.manualOnly') }}</p>
          <div class="flex items-center justify-between gap-3">
            <UButton :loading="busy" :disabled="!blogId || !author.trim() || !data.canManage" @click="save">{{
              $t('common.actions.save')
            }}</UButton>
            <UButton color="error" variant="ghost" :disabled="busy || !data.canManage" @click="disconnect">{{
              $t('common.shopify.disconnect')
            }}</UButton>
          </div>
        </template>
      </template>
    </template>
  </section>
</template>
