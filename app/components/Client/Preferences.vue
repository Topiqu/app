<template>
  <Modal v-model="open" :title="$t('common.preferences.title')" :onClose="confirmClose" class="max-w-4xl">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #close>
      <LazyClientHint v-if="auth?.user?.plan !== 'BASIC'" v-slot="{ open: clientHintOpen }" hydrateOnInteraction>
        <button
          class="flex items-center justify-center p-2 rounded-full bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 border-none outline-none cursor-pointer"
          :title="$t('common.preferences.explanation')"
          @click="clientHintOpen.value = true"
        >
          <Icon name="mdi:information-outline" class="size-6 text-gray-600 dark:text-gray-300" />
        </button>
      </LazyClientHint>
    </template>

    <template #content>
      <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-16">
        {{ $t('common.loading') }}
      </div>

      <div v-else class="flex gap-8">
        <div class="flex-1 space-y-8 overflow-y-auto max-h-[70vh] pr-4">
          <LazyFormClientBranding
            :logoUrl="form.logoUrl"
            :description="form.description"
            :socials="form.socials"
            :name="client?.name ?? ''"
            :subdomain="client?.subdomain ?? ''"
            :currentTheme="form.theme"
            @update:logoUrl="form.logoUrl = $event"
            @update:description="form.description = $event"
            @update:socials="form.socials = $event"
            @update:currentTheme="form.theme = $event as typeof form.theme"
          />

          <LazyFormClientContent
            v-if="auth?.user?.plan !== 'BASIC'"
            :plan="auth?.user?.plan ?? 'BASIC'"
            :focus="form.focus"
            :audience="form.audience"
            :language="form.language"
            :keywords="form.keywords"
            @update:focus="form.focus = $event"
            @update:audience="form.audience = $event"
            @update:language="form.language = $event as typeof form.language"
            @update:keywords="form.keywords = $event"
          />

          <section v-if="auth?.user?.plan !== 'BASIC'">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="mdi:google-analytics" class="w-5 h-5 text-orange-500" />
              {{ $t('common.preferences.external') }}
            </h3>

            <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-6">
              <div class="flex items-center justify-between">
                <span class="font-medium">Google Analytics</span>
                <FormField v-model="form.allowGtag" type="checkbox" label="" class="cursor-pointer" />
              </div>
              <Transition name="fade">
                <FormField
                  v-if="form.allowGtag"
                  v-model="form.gtagId"
                  label="Measurement ID"
                  placeholder="G-XXXXXXXXXX"
                  icon="mdi:tag-outline"
                />
              </Transition>

              <div class="pt-4 border-t border-white/10">
                <div class="flex items-center justify-between mb-3">
                  <span class="font-medium">Google Ads</span>
                  <FormField v-model="form.allowAds" type="checkbox" label="" class="cursor-pointer" />
                </div>
                <Transition name="fade">
                  <FormField
                    v-if="form.allowAds"
                    v-model="form.gamNetworkCode"
                    label="Network Code"
                    placeholder="XXXXXXXXXX"
                    icon="mdi:code-tags"
                  />
                </Transition>
              </div>
            </div>
          </section>

          <section v-if="auth?.user?.plan !== 'BASIC' && client?.tokenLimit && client?.tokenLimit > 0">
            <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <LazyFormClientAI
                :username="form.aiUser.username"
                :bio="form.aiUser.bio"
                :avatarUrl="form.aiUser.avatarUrl"
                :aiEnabled="activeFeatures.includes('AI')"
                :sentimentEnabled="activeFeatures.includes('SENTIMENT')"
                :articleCronsEnabled="activeFeatures.includes('ARTICLE_CRONS')"
                :canEnableAi="allowedFeatures.AI"
                :canEnableSentiment="allowedFeatures.SENTIMENT"
                :canEnableArticleCrons="allowedFeatures.ARTICLE_CRONS"
                :features
                :currency="client?.currency ?? 'EUR'"
                @toggle:feature="toggleFeature"
                @update:username="form.aiUser.username = $event"
                @update:bio="form.aiUser.bio = $event"
                @update:avatarUrl="form.aiUser.avatarUrl = $event"
              />
            </div>
          </section>
        </div>

        <div v-if="showPricing" class="w-64 shrink-0">
          <div class="sticky top-6 space-y-4">
            <div
              class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
            >
              <div class="text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider mb-1">
                {{ $t('common.preferences.monthlyTitle') }}
              </div>
              <div class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                {{ monthlyPrice }}
                <span class="text-xl text-neutral-500 dark:text-neutral-400">{{ client?.currency ?? 'EUR' }}</span>
              </div>
              <div class="text-neutral-500 dark:text-neutral-400 text-xs mt-1">
                /{{ $t('common.preferences.monthly') }}
              </div>
            </div>

            <div
              class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
            >
              <div class="text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider mb-1">
                {{ $t('common.preferences.annuallyTitle') }}
              </div>
              <div class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                {{ annualPrice }}
                <span class="text-xl text-neutral-500 dark:text-neutral-400">{{ client?.currency ?? 'EUR' }}</span>
              </div>
              <div class="text-neutral-500 dark:text-neutral-400 text-xs mt-1">
                /{{ $t('common.preferences.annually') }}
              </div>
              <div
                v-if="client?.billingPlan === 'ANNUAL'"
                class="mt-3 text-xl font-bold text-emerald-600 dark:text-emerald-400"
              >
                –20 %
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end pt-6 border-t border-gray-300 dark:border-gray-600">
        <Button variant="neutral" @click="close">
          {{ $t('common.messages.deleteCancel') }}
        </Button>
        <Button @click="savePreferences">
          {{ $t('common.actions.saveChanges') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '@prisma/client'
import type { ThemeSchema, LanguageSchema } from '~~/shared/zod/enums'

import Swal from 'sweetalert2'

const toast = useToast()
const { data: auth } = useAuth()
const open = defineModel<boolean>()

const form = ref({
  focus: '',
  audience: '',
  language: 'en' as (typeof LanguageSchema.options)[number],
  theme: 'blue' as (typeof ThemeSchema.options)[number],
  keywords: [] as string[],
  description: '',
  logoUrl: '',
  socials: [] as { platform: SocialPlatform; url: string }[],
  aiUser: { username: '', bio: '', avatarUrl: '' },
  gtagId: '',
  gamNetworkCode: '',
  allowAds: false,
  allowGtag: false,
})

interface ClientSite {
  id: string
  name: string
  subdomain: string
  plan: string
  focus: string | null
  audience: string | null
  language: (typeof LanguageSchema.options)[number]
  theme: (typeof ThemeSchema.options)[number]
  keywords: string[] | null
  description: string | null
  logoUrl: string | null
  generationFrequency: string
  tokenLimit: number | null
  tokenRemaining: number | null
  lastGeneratedAt: string | null
  socials: { platform: SocialPlatform; url: string }[]
  aiUser?: { username: string; bio: string; avatarUrl: string }
  gtagId?: string | null
  gamNetworkCode?: string | null
  allowAds: boolean
  allowGtag?: boolean | null
  monthlyPayment?: number | null
  annualPayment?: number | null
  currency?: string | null
  billingPlan?: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
  activeFeatures?: string[]
  allowedFeatures?: { AI?: boolean; SENTIMENT?: boolean; ARTICLE_CRONS?: boolean }
}

const { data: client, refresh, pending } = await useFetch<ClientSite>(`/api/clients/${auth.value?.user.clientSiteId}`)
const { data: features } = await useFetch(`/api/features`)

const rate = await useCurrencyRate(client.value?.currency ?? 'EUR')

const activeFeatures = computed(() => client.value?.activeFeatures ?? [])
const allowedFeatures = computed(
  () => client.value?.allowedFeatures ?? { AI: false, SENTIMENT: false, ARTICLE_CRONS: false },
)

const monthlyPrice = computed(() => {
  if (client.value?.billingPlan === 'PERMANENT') return 0
  const base = client.value?.monthlyPayment ?? 0
  const price = client.value?.currency === 'CZK' ? base : base / rate
  return Number(price.toFixed(2))
})

const annualPrice = computed(() => {
  if (client.value?.billingPlan === 'PERMANENT') return 0
  const base = monthlyPrice.value * 12
  const price = client.value?.billingPlan === 'ANNUAL' ? base * 0.8 : base
  return Number(price.toFixed(2))
})
const showPricing = computed(() => client.value?.billingPlan !== 'PERMANENT')

watch(
  client,
  (c) => {
    if (!c) return
    form.value = {
      ...form.value,
      focus: c.focus ?? '',
      audience: c.audience ?? '',
      language: c.language,
      theme: c.theme,
      description: c.description ?? '',
      logoUrl: c.logoUrl ?? '',
      keywords: c.keywords ?? [],
      socials: c.socials ?? [],
      aiUser: {
        username: c.aiUser?.username ?? '',
        bio: c.aiUser?.bio ?? '',
        avatarUrl: c.aiUser?.avatarUrl ?? '',
      },
      gtagId: c.gtagId ?? '',
      gamNetworkCode: c.gamNetworkCode ?? '',
      allowAds: c.allowAds,
      allowGtag: c.allowGtag ?? false,
    }
  },
  { immediate: true },
)

const toggleFeature = async ({ code, enabled }: { code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'; enabled: boolean }) => {
  if (!client.value?.id) return
  try {
    const res = await $fetch<ClientSite>(`/api/clients/${client.value.id}/features`, {
      method: 'PATCH',
      body: { code, enabled },
    })
    client.value = res
    toast.success({ message: enabled ? $t('common.messages.featureEnabled') : $t('common.messages.featureDisabled') })
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
    await refresh()
  }
}

const savePreferences = async () => {
  if (!auth.value?.user.clientSiteId) return toast.error({ message: $t('common.preferences.messages.noClientId') })
  try {
    await $fetch(`/api/clients/${auth.value.user.clientSiteId}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...form.value,
        socials: form.value.socials.filter((s) => s.url.trim()),
        aiUser: client.value?.tokenLimit && client.value.tokenLimit > 0 ? form.value.aiUser : undefined,
      },
    })
    toast.success({ message: $t('common.messages.successGeneralTitle') })
    await refresh()
    open.value = false
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
  }
}

const confirmClose = async () => {
  const changed =
    form.value.focus !== (client.value?.focus ?? '') ||
    form.value.audience !== (client.value?.audience ?? '') ||
    form.value.language !== client.value?.language ||
    form.value.theme !== client.value?.theme ||
    form.value.description !== (client.value?.description ?? '') ||
    form.value.logoUrl !== (client.value?.logoUrl ?? '') ||
    JSON.stringify(form.value.keywords) !== JSON.stringify(client.value?.keywords ?? []) ||
    JSON.stringify(form.value.socials) !== JSON.stringify(client.value?.socials ?? []) ||
    form.value.gtagId !== (client.value?.gtagId ?? '') ||
    form.value.gamNetworkCode !== (client.value?.gamNetworkCode ?? '') ||
    form.value.allowAds !== client.value?.allowAds ||
    form.value.allowGtag !== (client.value?.allowGtag ?? false) ||
    (client.value?.tokenLimit &&
      client.value.tokenLimit > 0 &&
      (form.value.aiUser.username !== (client.value.aiUser?.username ?? '') ||
        form.value.aiUser.bio !== (client.value.aiUser?.bio ?? '') ||
        form.value.aiUser.avatarUrl !== (client.value.aiUser?.avatarUrl ?? '')))

  if (!changed) return (open.value = false)

  const r = await Swal.fire({
    title: $t('common.messages.closeConfirmTitle'),
    text: $t('common.messages.closeConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: $t('common.messages.closeConfirmButton'),
    cancelButtonText: $t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })

  if (r.isConfirmed) open.value = false
}
</script>
