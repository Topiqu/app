<template>
  <section class="custom-ui relative py-32 px-6 overflow-hidden bg-slate-50 dark:bg-[#020408]">
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
      <div
        class="absolute top-24 left-24 w-96 h-96 bg-[rgb(93,66,232)]/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob"
      ></div>
      <div
        class="absolute top-48 right-24 w-96 h-96 bg-[rgb(30,64,175)]/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000"
      ></div>
    </div>

    <div class="relative max-w-3xl mx-auto z-10">
      <div class="text-center mb-16">
        <span
          class="inline-flex items-center justify-center px-4 py-1.5 mb-6 text-sm font-medium text-[rgb(93,66,232)] bg-[rgb(93,66,232)]/5 rounded-full border border-[rgb(93,66,232)]/20 shadow-sm backdrop-blur-sm"
        >
          {{ $t('landing.faq.badge') }}
        </span>
        <h2 class="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
          {{ $t('landing.faq.title') }}
        </h2>
        <p class="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          {{ $t('landing.faq.subtitle') }}
        </p>
      </div>

      <div class="space-y-4">
        <div
          v-for="(item, index) in faqItems"
          :key="index"
          class="group border-b border-slate-200 dark:border-white/10 last:border-0"
        >
          <div
            role="button"
            tabindex="0"
            class="flex items-center justify-between py-6 cursor-pointer select-none outline-none"
            @click="toggleItem(index)"
            @keydown.enter.prevent="toggleItem(index)"
          >
            <span
              class="font-bold text-lg text-slate-900 dark:text-white transition-colors duration-300 pr-8 group-hover:text-[rgb(93,66,232)]"
              :class="{ 'text-[rgb(93,66,232)]': activeItem === index }"
            >
              {{ $t(item.question) }}
            </span>

            <div
              class="flex-shrink-0 relative w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300"
              :class="
                activeItem === index
                  ? 'bg-[rgb(93,66,232)] text-white rotate-180'
                  : 'bg-transparent text-slate-400 group-hover:text-[rgb(93,66,232)]'
              "
            >
              <Icon v-if="activeItem !== index" name="mdi:plus" size="24" class="transition-transform duration-300" />
              <Icon v-else name="mdi:minus" size="24" class="transition-transform duration-300" />
            </div>
          </div>

          <div
            class="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            :class="activeItem === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
          >
            <div class="overflow-hidden">
              <div class="pb-6 text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-[95%]">
                {{ $t(item.answer) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-16 flex justify-center">
        <Button
          variant="primary"
          size="lg"
          animation="softpop"
          icon="mdi:lifebuoy"
          class="!bg-[rgb(93,66,232)] hover:!bg-[rgb(79,56,199)] shadow-lg shadow-[rgb(93,66,232)]/20 text-white"
        >
          {{ $t('landing.faq.cta_button') }}
        </Button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const activeItem = shallowRef<number | null>(0)

const toggleItem = (index: number) => {
  if (activeItem.value === index) {
    activeItem.value = null
  } else {
    activeItem.value = index
  }
}

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
</script>
