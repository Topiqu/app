<script setup lang="ts">
import type { ShopifyBlog } from '~~/shared/types/shopify'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()
const { data, status, error, refresh } = await useShopify()
const blogId = shallowRef('')
const author = shallowRef('')
const blogs = shallowRef<ShopifyBlog[]>([])
const busy = shallowRef(false)
const blogsError = shallowRef(false)
const connected = computed(() => data.value?.connection?.status === 'CONNECTED')
const blogItems = computed(() => blogs.value.map((blog) => ({ label: blog.title, value: blog.id })))
const notice = computed(() => (typeof route.query.shopify === 'string' ? route.query.shopify : ''))
const noticeKey = computed(() => (['linked', 'expired'].includes(notice.value) ? notice.value : ''))

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
    blogId.value = connection?.blogId || ''
    author.value = connection?.author || 'Topiqu'
    if (connection?.status === 'CONNECTED' && data.value?.eligible) void loadBlogs()
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
const link = () =>
  action(async () => {
    await $fetch('/api/shopify/link', { method: 'POST' })
    await refresh()
    toast.add({ color: 'success', title: t('common.shopify.callback.linked') })
  })
const cancelLink = () =>
  action(async () => {
    await $fetch('/api/shopify/link', { method: 'DELETE' })
    await refresh()
  })
// Reconnecting and new scopes are granted by opening the app in the store admin.
const openInShopify = () => {
  if (data.value?.adminUrl) window.open(data.value.adminUrl, '_blank', 'noopener')
}
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
        :color="noticeKey === 'linked' ? 'success' : 'warning'"
        :title="$t(`common.shopify.callback.${noticeKey}`)"
      />
      <UAlert v-if="!data.configured" color="warning" :title="$t('common.shopify.notConfigured')" />
      <div v-else-if="data.pending" class="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
        <p class="font-medium text-highlighted">
          {{ $t('common.shopify.pending.title', { shop: data.pending.shopName }) }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('common.shopify.pending.description', { shop: data.pending.shop, project: data.pending.project }) }}
        </p>
        <p v-if="data.pending.shopifyBilling" class="text-sm text-muted">{{ $t('common.shopify.pending.billing') }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton icon="mdi:shopify" :loading="busy" :disabled="!data.canManage" @click="link">
            {{ $t('common.shopify.pending.confirm') }}
          </UButton>
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="cancelLink">
            {{ $t('common.shopify.pending.cancel') }}
          </UButton>
        </div>
      </div>
      <div v-else-if="!data.connection" class="space-y-3">
        <p class="text-sm text-muted">{{ $t('common.shopify.install.description') }}</p>
        <UButton
          v-if="data.installUrl"
          icon="mdi:shopify"
          trailingIcon="mdi:open-in-new"
          :to="data.installUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ $t('common.shopify.install.action') }}
        </UButton>
      </div>
      <template v-else>
        <div class="flex items-center justify-between gap-3 rounded-lg border border-default p-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-highlighted">{{ data.connection.shopName }}</p>
            <p class="truncate text-xs text-muted">{{ data.connection.shop }}</p>
          </div>
          <UBadge :color="connected ? 'success' : 'warning'" variant="soft">{{
            $t(`common.shopify.connection.${data.connection.status}`)
          }}</UBadge>
        </div>
        <UAlert v-if="!connected" color="warning" :title="$t('common.shopify.reconnectHint')">
          <template v-if="data.adminUrl" #actions>
            <UButton color="neutral" variant="soft" trailingIcon="mdi:open-in-new" @click="openInShopify">
              {{ $t('common.shopify.openInShopify') }}
            </UButton>
          </template>
        </UAlert>
        <UAlert
          v-else-if="!data.eligible && data.billingProvider === 'SHOPIFY'"
          color="warning"
          :title="$t('common.shopify.planRequired')"
        >
          <template v-if="data.pricingUrl" #actions>
            <UButton
              color="neutral"
              variant="soft"
              trailingIcon="mdi:open-in-new"
              :to="data.pricingUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t('common.shopify.choosePlan') }}
            </UButton>
          </template>
        </UAlert>
        <UAlert v-else-if="!data.eligible" color="warning" :title="$t('common.shopify.requiresPlan')" />
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
          <div class="flex justify-start">
            <UButton :loading="busy" :disabled="!blogId || !author.trim() || !data.canManage" @click="save">{{
              $t('common.actions.save')
            }}</UButton>
          </div>
          <FormClientShopifyCatalog v-if="data.canManage" @reconnect="openInShopify" />
        </template>
        <div v-if="data.connection.status !== 'REVOKED'" class="flex justify-end">
          <UButton color="error" variant="ghost" :disabled="busy || !data.canManage" @click="disconnect">{{
            $t('common.shopify.disconnect')
          }}</UButton>
        </div>
      </template>
    </template>
  </section>
</template>
