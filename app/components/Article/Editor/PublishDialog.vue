<template>
  <UModal
    v-model:open="open"
    :title="$t(topiquPublished ? 'articles.editor.publishDialog.titleUpdate' : 'articles.editor.publishDialog.title')"
    :description="
      $t(
        topiquPublished
          ? 'articles.editor.publishDialog.descriptionUpdate'
          : 'articles.editor.publishDialog.description',
      )
    "
  >
    <template #body>
      <div class="space-y-4" data-publish-dialog>
        <UCheckbox
          v-if="!topiquPublished"
          v-model="topiqu"
          :disabled="topiquEnabled === false"
          :label="$t('articles.editor.publishDialog.topiqu')"
          :description="
            topiquEnabled === false
              ? $t('common.errors.publicationChannelDisabled')
              : $t('articles.editor.publishDialog.topiquHelp')
          "
        />
        <div class="space-y-3">
          <UCheckbox
            v-model="shopify"
            :label="inShopify ? $t('common.shopify.update') : $t('articles.editor.publishDialog.shopify')"
            :description="blog ? $t('articles.editor.publishDialog.shopifyHelp', { blog }) : undefined"
          />
          <div v-if="shopify" class="ms-7 space-y-3">
            <URadioGroup
              v-model="mode"
              :items="modes"
              :legend="$t('articles.editor.publishDialog.mode')"
              orientation="horizontal"
            />
            <p v-if="scheduled" class="text-xs text-muted">{{ $t('articles.editor.publishDialog.scheduled') }}</p>
            <UAlert v-if="warning" color="warning" variant="soft" :description="warning" />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('common.actions.cancel') }}</UButton>
        <UButton :loading :disabled="!topiquIncluded && !shopify" data-publish-confirm @click="submit">{{
          confirmLabel
        }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { PublishChoice, ShopifyPublication, ShopifyPublishMode } from '~~/shared/types/shopify'

const open = defineModel<boolean>('open', { default: false })
const {
  topiquPublished,
  topiquEnabled = true,
  scheduled,
  blog,
  publication,
  label,
  loading,
} = defineProps<{
  topiquPublished: boolean
  topiquEnabled?: boolean
  scheduled: boolean
  blog?: string | null
  publication?: ShopifyPublication | null
  label: string
  loading?: boolean
}>()
const emit = defineEmits<{ confirm: [choice: PublishChoice] }>()
const { t } = useI18n()

// An article already in Shopify keeps its own state; the remembered choice seeds new ones.
const remembered = useLocalStorage<{ shopify: boolean; mode: ShopifyPublishMode }>('topiqu-publish-channels', {
  shopify: true,
  mode: 'published',
})
const topiqu = shallowRef(true)
const shopify = shallowRef(true)
const mode = shallowRef<ShopifyPublishMode>('published')
const inShopify = computed(() => Boolean(publication?.shopifyArticleId))

watch(
  open,
  (value) => {
    if (!value) return
    topiqu.value = topiquEnabled !== false
    shopify.value = inShopify.value || remembered.value.shopify
    if (scheduled) mode.value = 'draft'
    else mode.value = inShopify.value ? (publication?.isPublished ? 'published' : 'draft') : remembered.value.mode
  },
  { immediate: true },
)

const shopifyMode = computed<ShopifyPublishMode>(() => (scheduled ? 'draft' : mode.value))
const modes = computed(() => [
  { label: t('articles.editor.publishDialog.draft'), value: 'draft' },
  { label: t('articles.editor.publishDialog.published'), value: 'published', disabled: scheduled },
])
const warning = computed(() => {
  if (!shopify.value || !inShopify.value) return null
  return shopifyMode.value === 'draft' && publication?.isPublished
    ? t('common.shopify.unpublishDescription')
    : t('common.shopify.replaceDescription')
})
const topiquIncluded = computed(() => topiquEnabled !== false && (topiquPublished || topiqu.value))
const confirmLabel = computed(() => (topiquIncluded.value ? label : t('articles.editor.publishDialog.sendOnly')))

const submit = () => {
  if (!topiquIncluded.value && !shopify.value) return
  if (!inShopify.value && !scheduled) remembered.value = { shopify: shopify.value, mode: mode.value }
  emit('confirm', { topiqu: topiquIncluded.value, shopify: shopify.value ? shopifyMode.value : null })
}
</script>
