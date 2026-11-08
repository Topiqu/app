<template>
  <UModal
    v-model:open="open"
    :title="$t('articles.editor.productPicker.title')"
    :description="$t('articles.editor.productPicker.description')"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <UInput
          v-model="query"
          type="search"
          icon="mdi:magnify"
          class="w-full"
          :placeholder="$t('articles.editor.productPicker.search')"
          :aria-label="$t('articles.editor.productPicker.search')"
          :loading="status === 'pending'"
        />
        <ul v-if="products.length" class="flex max-h-96 flex-col gap-1 overflow-y-auto">
          <li v-for="product in products" :key="product.id">
            <UButton
              block
              color="neutral"
              variant="ghost"
              trailingIcon="mdi:plus"
              :loading="inserting === product.id"
              :disabled="inserting !== null"
              :ui="{ base: 'justify-start text-left' }"
              @click="insert(product.id)"
            >
              <AppMedia
                :src="product.cdnImageUrl"
                alt=""
                aspectRatio="1 / 1"
                fit="contain"
                sizes="48px"
                :width="48"
                :height="48"
                fallbackIcon="mdi:shopping-outline"
                containerClass="size-12 shrink-0 rounded-md"
              />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium text-highlighted">{{ product.name }}</span>
                <span class="truncate text-xs text-muted">
                  {{ [product.brand, price(product), availability(product)].filter(Boolean).join(' · ') }}
                </span>
              </span>
            </UButton>
          </li>
        </ul>
        <p v-else-if="status !== 'pending'" class="text-sm text-muted">
          {{ $t('articles.editor.productPicker.empty') }}
        </p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ProductCardRef } from '~~/shared/utils/articleEmbeds'

type ProductOption = {
  id: string
  name: string
  brand: string | null
  price: string | null
  currency: string | null
  availability: 'IN_STOCK' | 'PREORDER' | 'BACKORDER'
  cdnImageUrl: string | null
}

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ insert: [card: ProductCardRef] }>()

const { locale } = useI18n()
const toast = useToast()
const query = shallowRef('')
const search = refDebounced(query, 300)
const inserting = shallowRef<string | null>(null)

const {
  data: products,
  status,
  execute,
} = useLazyFetch<ProductOption[]>('/api/knowledge/products', {
  query: { q: search },
  immediate: false,
  watch: false,
  default: () => [],
})

watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ''
  execute()
})
watch(search, () => open.value && execute())

const price = ({ price, currency }: ProductOption) => {
  if (!price || !currency) return null
  try {
    return new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(Number(price))
  } catch {
    return null
  }
}
const availability = ({ availability }: ProductOption) => $t(`articles.productCard.availability.${availability}`)

const insert = async (id: string) => {
  inserting.value = id
  try {
    emit(
      'insert',
      await $fetch<ProductCardRef>(`/api/knowledge/products/${encodeURIComponent(id)}/card`, { method: 'POST' }),
    )
    open.value = false
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, $t('articles.editor.productPicker.failed')) })
  } finally {
    inserting.value = null
  }
}
</script>
