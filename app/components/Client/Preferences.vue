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
      <div v-else class="flex flex-col gap-6 mt-6">
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{{
            $t('common.preferences.companyLogo.label')
          }}</span>
          <FileUploader
            :imageUrl="client?.logoUrl"
            type="client-logo"
            :maxWidth="1920"
            :maxHeight="1080"
            @upload="onLogoUpload"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('common.preferences.companyLogo.description') }}
          </span>
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {{ $t('common.preferences.companyDescription.label') }}
          </span>
          <textarea
            v-model="form.description"
            :placeholder="$t('common.preferences.companyDescription.placeholder')"
            maxlength="255"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300 resize-none h-24"
          ></textarea>
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{{
            $t('common.preferences.focus.label')
          }}</span>
          <input
            v-model="form.focus"
            :placeholder="$t('common.preferences.focus.placeholder')"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
          />
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {{ $t('common.preferences.audience.label') }}
          </span>
          <input
            v-model="form.audience"
            :placeholder="$t('common.preferences.audience.placeholder')"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
          />
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {{ $t('common.preferences.language.label') }}
          </span>
          <select
            v-model="form.language"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
          >
            <option disabled>{{ $t('common.preferences.language.placeholder') }}</option>
            <option v-for="lang in LanguageSchema.options" :key="lang" :value="lang">
              {{ $t(`languages.${lang}`) }}
            </option>
          </select>
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {{ $t('common.preferences.theme.label') }}
          </span>
          <div class="grid grid-cols-5 gap-6 max-w-sm justify-items-center">
            <Button
              v-for="theme in ThemeSchema.options"
              :key="theme"
              type="button"
              :icon="form.theme === theme ? 'mdi:check' : undefined"
              :style="{ backgroundColor: theme }"
              class="size-12! rounded-full! aspect-square"
              :class="
                form.theme === theme
                  ? 'ring-2 ring-blue-500 scale-110'
                  : 'hover:scale-105 border border-gray-300 dark:border-gray-600'
              "
              @click="form.theme = theme"
            />
          </div>
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {{ $t('common.preferences.keywords.label') }}
          </span>
          <input
            v-model="keywordsInput"
            :placeholder="$t('common.preferences.keywords.placeholder')"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
            @input="updateKeywords"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">{{
            $t('common.preferences.keywords.count', [form.keywords.length])
          }}</span>
        </label>
        <div
          v-if="auth?.user?.plan !== 'BASIC' && client.tokenLimit && client.tokenLimit > 0"
          class="flex flex-col gap-6 p-6 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
        >
          <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Icon name="mdi:robot" class="w-5 h-5" />
            {{ $t('common.preferences.aiAuthor.title') }}
          </h3>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
              $t('common.preferences.aiAuthor.username.label')
            }}</span>
            <input
              v-model="form.aiUser.username"
              :placeholder="$t('common.preferences.aiAuthor.username.placeholder')"
              class="p-3 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all duration-200 shadow-sm"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('common.avatar.ai.label') }}</span>
            <FileUploader
              :imageUrl="form.aiUser.avatarUrl"
              type="user-avatar"
              :isAiUser="true"
              @upload="form.aiUser.avatarUrl = $event.url"
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
              $t('common.preferences.aiAuthor.bio.label')
            }}</span>
            <textarea
              v-model="form.aiUser.bio"
              :placeholder="$t('common.preferences.aiAuthor.bio.placeholder')"
              maxlength="300"
              class="p-3 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all duration-200 shadow-sm resize-y min-h-[100px]"
            />
          </label>
        </div>
        <div class="flex flex-col gap-6">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
              {{ $t('common.preferences.socials.label') }}
            </span>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="platform in socialPlatforms"
                :key="platform"
                variant="transparent"
                :icon="platformIcons[platform]"
                :disabled="form.socials.some((s) => s.platform === platform)"
                class="text-white"
                :class="[
                  form.socials.some((s) => s.platform === platform)
                    ? 'bg-gray-200 dark:bg-gray-700 opacity-50'
                    : `${platformStyles[platform].bg}!`,
                ]"
                @click="addSocial(platform)"
              />
            </div>
          </div>

          <div v-if="form.socials.length" class="grid gap-4">
            <div
              v-for="(social, index) in form.socials"
              :key="index"
              class="rounded-xl border bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
              :class="[
                platformStyles[social.platform].border,
                isValidUrl(social.url) ? '' : 'border-red-500 dark:border-red-400',
              ]"
            >
              <div class="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
                <div
                  class="flex items-center justify-center w-9 h-9 rounded-lg"
                  :class="platformStyles[social.platform].bg"
                >
                  <Icon :name="platformIcons[social.platform]" class="w-5 h-5 text-white" />
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ social.platform }}</span>
                <button
                  class="ml-auto p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  @click="removeSocial(index)"
                >
                  <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
                </button>
              </div>
              <div class="relative p-4">
                <Icon
                  :name="platformIcons[social.platform]"
                  class="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5"
                  :class="platformStyles[social.platform].text"
                />
                <input
                  v-model="social.url"
                  :placeholder="platformPlaceholders[social.platform]"
                  class="w-full pl-12 pr-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-all duration-300"
                  :class="[
                    isValidUrl(social.url)
                      ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70'
                      : 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-500/70',
                  ]"
                  maxlength="255"
                  @blur="normalizeUrl(index)"
                />
              </div>
            </div>
          </div>

          <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{
            $t('common.preferences.socials.noSocials')
          }}</span>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0 pt-4 border-t border-gray-300 dark:border-gray-600">
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
const socialPlatforms: SocialPlatform[] = ['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'OTHER']
const init = {
  focus: '',
  audience: '',
  language: 'en' as unknown as (typeof LanguageSchema.options)[number],
  theme: 'blue' as unknown as (typeof ThemeSchema.options)[number],
  keywords: [] as string[],
  description: '',
  logoUrl: '',
  socials: [] as { platform: SocialPlatform; url: string }[],
  aiUser: { username: '', bio: '', avatarUrl: '' },
}
const form = ref<typeof init>({ ...init })
const keywordsInput = shallowRef('')

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
}

const platformIcons: Record<SocialPlatform, string> = {
  FACEBOOK: 'mdi:facebook',
  TWITTER: 'mdi:alpha-x-circle',
  INSTAGRAM: 'mdi:instagram',
  LINKEDIN: 'mdi:linkedin',
  YOUTUBE: 'mdi:youtube',
  OTHER: 'mdi:web',
}

const platformStyles: Record<SocialPlatform, { bg: string; border: string; text: string }> = {
  FACEBOOK: {
    bg: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    border: 'border-blue-600 dark:border-blue-500',
    text: 'text-blue-600 dark:text-blue-500',
  },
  TWITTER: {
    bg: 'bg-black hover:bg-gray-800',
    border: 'border-black dark:border-gray-200',
    text: 'text-black dark:text-gray-200',
  },
  INSTAGRAM: {
    bg: 'bg-pink-500 hover:bg-pink-600 dark:bg-pink-400 dark:hover:bg-pink-500',
    border: 'border-pink-500 dark:border-pink-400',
    text: 'text-pink-500 dark:text-pink-400',
  },
  LINKEDIN: {
    bg: 'bg-blue-800 hover:bg-blue-900 dark:bg-blue-700 dark:hover:bg-blue-800',
    border: 'border-blue-800 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-700',
  },
  YOUTUBE: {
    bg: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    border: 'border-red-600 dark:border-red-500',
    text: 'text-red-600 dark:text-red-500',
  },
  OTHER: {
    bg: 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600',
    border: 'border-gray-600 dark:border-gray-500',
    text: 'text-gray-600 dark:text-gray-500',
  },
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
    language: LanguageSchema.options[0] as unknown as (typeof LanguageSchema.options)[number],
    theme: ThemeSchema.options[0] as unknown as (typeof ThemeSchema.options)[number],
    keywords: [],
    description: null,
    logoUrl: null,
    generationFrequency: 'NONE',
    tokenLimit: null,
    tokenRemaining: null,
    lastGeneratedAt: null,
    socials: [],
    aiUser: { username: '', bio: '', avatarUrl: '' },
  }),
})

const platformPlaceholders = computed(() => {
  return {
    FACEBOOK: `https://facebook.com/${client.value?.name}`,
    TWITTER: `https://x.com/${client.value?.name}`,
    INSTAGRAM: `https://instagram.com/${client.value?.name}`,
    LINKEDIN: `https://linkedin.com/company/${client.value?.name}`,
    YOUTUBE: `https://youtube.com/@${client.value?.name}`,
    OTHER: `https://${client.value?.subdomain}.cz`,
  }
})
if (client.value) {
  Object.assign(form.value, {
    focus: client.value.focus ?? '',
    audience: client.value.audience ?? '',
    language: client.value.language ?? 'en',
    theme: client.value.theme ?? 'blue',
    description: client.value.description ?? '',
    logoUrl: client.value.logoUrl ?? '',
    keywords: client.value.keywords ?? [],
    socials: client.value.socials ?? [],
    aiUser: {
      username: client.value.aiUser?.username ?? '',
      bio: client.value.aiUser?.bio ?? '',
      avatarUrl: client.value.aiUser?.avatarUrl ?? '',
    },
  })
  keywordsInput.value = (client.value.keywords ?? []).join(', ')
}

const onLogoUpload = ({ url }: { url: string }) => (form.value.logoUrl = url)
const updateKeywords = () =>
  (form.value.keywords = keywordsInput.value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean))
const addSocial = (p: SocialPlatform) => {
  if (!form.value.socials.some((s) => s.platform === p)) {
    form.value.socials.push({
      platform: p,
      url: platformPlaceholders.value[p],
    })
  }
}
const removeSocial = (i: number) => form.value.socials.splice(i, 1)
const isValidUrl = (u: string) => !u.trim() || (u.startsWith('https://') && !!new URL(u))
const normalizeUrl = (i: number) =>
  (form.value.socials[i]!.url = form.value.socials[i]!.url.replace(/^http:\/\//, 'https://'))

const savePreferences = async () => {
  if (!auth.value?.user.clientSiteId) return toast.error({ message: $t('common.preferences.messages.noClientId') })
  if (form.value.socials.some((s) => s.url.trim() && !isValidUrl(s.url)))
    return toast.error({ message: $t('common.preferences.messages.invalidUrl') })
  try {
    await $fetch(`/api/clients/${auth.value.user.clientSiteId}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...form.value,
        socials: form.value.socials.filter((s) => s.url.trim()),
        aiUser: client.value.tokenLimit && client.value.tokenLimit > 0 ? form.value.aiUser : undefined,
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
  const diff = (a: any[], b: any[]) =>
    a.length !== b.length || a.some((x, i) => JSON.stringify(x) !== JSON.stringify(b[i]))
  const changed =
    form.value.focus !== (client.value?.focus || '') ||
    form.value.audience !== (client.value?.audience || '') ||
    form.value.language !== (client.value?.language || 'en') ||
    form.value.theme !== (client.value?.theme || 'blue') ||
    form.value.description !== (client.value?.description || '') ||
    form.value.logoUrl !== (client.value?.logoUrl || '') ||
    form.value.keywords.join(',') !== (client.value?.keywords || []).join(',') ||
    diff(form.value.socials, client.value?.socials || []) ||
    (client.value.tokenLimit &&
      client.value.tokenLimit > 0 &&
      (form.value.aiUser.username !== (client.value.aiUser?.username || '') ||
        form.value.aiUser.bio !== (client.value.aiUser?.bio || '') ||
        form.value.aiUser.avatarUrl !== (client.value.aiUser?.avatarUrl || '')))
  if (changed) {
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
  } else open.value = false
}
</script>
