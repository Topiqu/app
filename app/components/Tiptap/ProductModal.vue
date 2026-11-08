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
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
              :disabled="inserting !== null"
              @click="insert(product.id)"
            >
              <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                <img
                  v-if="product.cdnImageUrl"
                  :src="product.cdnImageUrl"
                  alt=""
                  width="48"
                  height="48"
                  loading="lazy"
                  class="size-full object-contain"
                />
                <UIcon v-else name="mdi:shopping-outline" class="size-5 text-muted" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium text-highlighted">{{ product.name }}</span>
                <span class="truncate text-xs text-muted">
                  {{ [product.brand, price(product), availability(product)].filter(Boolean).join(' · ') }}
                </span>
              </span>
              <UIcon
                :name="inserting === product.id ? 'mdi:loading' : 'mdi:plus'"
                class="size-5 shrink-0 text-muted"
                :class="{ 'animate-spin': inserting === product.id }"
              />
            </button>
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
