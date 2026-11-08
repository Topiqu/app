<template>
  <aside
    :aria-label="$t('articles.productCard.label', { name: product.name })"
    class="not-prose my-8 flex items-center gap-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-sm sm:gap-5 sm:p-5"
  >
    <!-- Fixed square box: the copy is at most 480 px on its longer side, any aspect, so it never shifts layout. -->
    <AppMedia
      v-if="product.imageUrl"
      :src="product.imageUrl"
      alt=""
      aspectRatio="1 / 1"
      fit="contain"
      sizes="96px sm:128px"
      :width="480"
      :height="480"
      containerClass="size-24 shrink-0 rounded-lg sm:size-32"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <p class="line-clamp-2 font-semibold text-highlighted">{{ product.name }}</p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span v-if="price" class="font-semibold tabular-nums text-highlighted">
          {{ $t('articles.productCard.from', { price }) }}
        </span>
        <UBadge
          v-if="product.availability"
          :color="product.availability === 'IN_STOCK' ? 'success' : 'neutral'"
          variant="soft"
          size="sm"
        >
          {{ $t(`articles.productCard.availability.${product.availability}`) }}
        </UBadge>
      </div>
      <UButton :to="product.url" external size="sm" trailingIcon="mdi:arrow-right" class="self-start">
        {{ $t('articles.productCard.view') }}<span class="sr-only">: {{ product.name }}</span>
      </UButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { ProductCardData } from '~~/shared/utils/articleEmbeds'

const { product } = defineProps<{ product: ProductCardData }>()
const { locale } = useI18n()

const price = computed(() => {
  if (!product.price || !product.currency) return null
  try {
    return new Intl.NumberFormat(locale.value, { style: 'currency', currency: product.currency }).format(
      Number(product.price),
    )
  } catch {
    return null
  }
})
</script>
