<template>
  <Modal v-model="open" :title="$t('common.preferences.title')" :onClose="confirmClose">
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
      <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">{{ $t('common.loading') }}</div>

      <div v-else class="flex flex-col gap-8 mt-6">
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
            {{ $t('common.preferences.analytics.title') }}
          </h3>

          <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-5 border border-white/10 space-y-6">
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
          <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <LazyFormClientAI
              :username="form.aiUser.username"
              :bio="form.aiUser.bio"
              :avatarUrl="form.aiUser.avatarUrl"
              @update:username="form.aiUser.username = $event"
              @update:bio="form.aiUser.bio = $event"
              @update:avatarUrl="form.aiUser.avatarUrl = $event"
            />
          </div>
        </section>
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

import Swal from 'sweetalert2'
import { ThemeSchema, LanguageSchema } from '~~/shared/zod/enums'

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
}

const {
  data: client,
  refresh,
  pending,
} = await useFetch<ClientSite>(`/api/clients/${auth.value?.user.clientSiteId}`, {
  default: () => ({
    id: '',
    name: '',
    subdomain: '',
    plan: 'BASIC',
    focus: null,
    audience: null,
    language: LanguageSchema.options[0],
    theme: ThemeSchema.options[0],
    keywords: [],
    description: null,
    logoUrl: null,
    generationFrequency: 'NONE',
    tokenLimit: null,
    tokenRemaining: null,
    lastGeneratedAt: null,
    socials: [],
    aiUser: { username: '', bio: '', avatarUrl: '' },
    gtagId: null,
    gamNetworkCode: null,
    allowAds: false,
    allowGtag: null,
  }),
})

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
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.saveFailed') })
  }
}

const confirmClose = async () => {
  const changed =
    form.value.focus !== (client.value?.focus ?? '') ||
    form.value.audience !== (client.value?.audience ?? '') ||
    form.value.language !== client.value.language ||
    form.value.theme !== client.value.theme ||
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
