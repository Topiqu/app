<template>
  <UPageSection :title="$t('landing.faq.title')" :description="$t('landing.faq.subtitle')">
    <template #headline>
      <UBadge color="primary" variant="soft" icon="i-mdi-frequently-asked-questions">
        {{ $t('landing.faq.badge') }}
      </UBadge>
    </template>
    <div class="mx-auto w-full max-w-3xl">
      <UAccordion type="single" collapsible :items="localizedFaqItems" class="w-full" />

      <div class="mt-16 flex justify-center">
        <UButton color="primary" variant="solid" size="lg" icon="i-mdi-lifebuoy">
          {{ $t('landing.faq.cta_button') }}
        </UButton>
      </div>
    </div>
  </UPageSection>
</template>

<script setup lang="ts">
const faqItems = [
  {
    question: 'landing.faq.items.0.q',
    answer: 'landing.faq.items.0.a',
  },
  {
    question: 'landing.faq.items.1.q',
    answer: 'landing.faq.items.1.a',
  },
  {
    question: 'landing.faq.items.2.q',
    answer: 'landing.faq.items.2.a',
  },
  {
    question: 'landing.faq.items.3.q',
    answer: 'landing.faq.items.3.a',
  },
]
const localizedFaqItems = computed(() =>
  faqItems.map((item, index) => ({ value: String(index), label: $t(item.question), content: $t(item.answer) })),
)
</script>
