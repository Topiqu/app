<template>
  <main class="w-full max-w-5xl mx-auto pt-24 sm:pt-28 px-4 sm:px-6 pb-28 flex flex-col gap-6">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {{ $t('profile.title') }}
      </h1>
      <Button
        square
        borderless
        size="sm"
        variant="neutral"
        icon="mdi:file-pdf-box"
        :disabled="isLoading"
        :aria="$t('profile.exportToPDF')"
        :title="$t('profile.exportToPDF')"
        @click="exportToPDF"
      />
    </header>

    <div class="flex flex-col md:flex-row gap-6 md:gap-10">
      <TabNav v-model="activeTab" :tabs="tabs" :label="$t('profile.title')" />

      <div class="flex-1 min-w-0">
        <div v-show="activeTab === 'profile'" class="space-y-6">
          <Panel>
            <UserIdentity
              v-model:avatarUrl="profileForm.avatarUrl"
              :username="profileForm.username"
              :handle="handle"
              :bio="profileForm.bio"
              :email="profileForm.email"
              :createdAt="profileForm.createdAt"
              @upload="onAvatarUpload"
            />
          </Panel>

          <Panel :title="$t('profile.publicProfile')" :description="$t('profile.publicProfileDescription')">
            <div class="space-y-4">
              <FormField
                id="username-section"
                v-model="profileForm.username"
                :label="$t('profile.username')"
                type="text"
                name="username"
                autocomplete="nickname"
              />
              <FormField
                id="bio-section"
                v-model="profileForm.bio"
                :label="$t('profile.bio')"
                type="textarea"
                name="bio"
                :maxLength="BIO_MAX_LENGTH"
              />
              <div id="language-section">
                <FormLabel as="span" :text="$t('profile.language')" />
                <LangSwitcher class="w-full mt-1" :language="currentLanguage" @update:language="updateLanguage" />
              </div>
            </div>
          </Panel>

          <Panel :title="$t('profile.accountDetails')" :description="$t('profile.accountDetailsDescription')">
            <dl class="divide-y divide-neutral-100 dark:divide-neutral-800 text-sm">
              <div id="id-section" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <dt class="text-neutral-500 dark:text-neutral-400">{{ $t('profile.id') }}</dt>
                <dd class="flex min-w-0 items-center gap-1">
                  <code class="truncate text-xs text-neutral-700 dark:text-neutral-300">{{ profileForm.id }}</code>
                  <Button
                    square
                    borderless
                    size="sm"
                    variant="transparent"
                    :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
                    :aria="$t('common.actions.copyLink')"
                    :title="$t('common.actions.copyLink')"
                    @click="copy(profileForm.id ?? '')"
                  />
                </dd>
              </div>
              <div id="registration-section" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <dt class="text-neutral-500 dark:text-neutral-400">{{ $t('profile.registrationDate') }}</dt>
                <dd class="text-neutral-700 dark:text-neutral-300">{{ formattedCreatedAt }}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div v-show="activeTab === 'security'" class="space-y-6">
          <Panel :title="$t('profile.health')" :description="$t('profile.healthDescription')">
            <UserAccountHealth @navigate="focusSection" />
          </Panel>

          <Panel id="email-section" :title="$t('profile.email')">
            <UserEmail
              v-model:email="profileForm.email!"
              v-model:isEmailVerified="profileForm.emailVerified!"
              v-model:isLoading="isLoading"
            />
          </Panel>

          <Panel id="password-section" :title="$t('common.auth.changePassword')">
            <div class="space-y-4">
              <div
                v-if="userData?.hasPassword"
                class="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/40"
              >
                <span class="text-xs text-neutral-500 dark:text-neutral-400">
                  <template v-if="userData.passwordChangedAt">
                    {{ $t('profile.passwordChangedAt') }}
                    <AppTime
                      :datetime="userData.passwordChangedAt"
                      preset="relative"
                      class="font-medium text-neutral-700 dark:text-neutral-300"
                    />
                  </template>
                  <template v-else>{{ $t('profile.passwordNeverMeasured') }}</template>
                </span>
                <span
                  v-if="isPasswordOld"
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                >
                  <Icon name="mdi:clock-alert-outline" class="size-3.5" />
                  {{ $t('profile.passwordOld') }}
                </span>
              </div>

              <div v-if="userData?.hasPassword">
                <FormLabel :for="oldPasswordId" :text="$t('common.auth.oldPassword')" />
                <FormInput
                  :id="oldPasswordId"
                  v-model="passwordForm.oldPassword"
                  :type="showOldPassword ? 'text' : 'password'"
                  name="oldPassword"
                  autocomplete="current-password"
                  :placeholder="$t('common.auth.oldPassword')"
                >
                  <template #icon>
                    <button
                      type="button"
                      class="absolute right-3 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center text-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      :aria-label="showOldPassword ? $t('common.hidePassword') : $t('common.showPassword')"
                      @click="showOldPassword = !showOldPassword"
                    >
                      <Icon :name="showOldPassword ? 'mdi:eye-off' : 'mdi:eye'" class="size-full text-[inherit]" />
                    </button>
                  </template>
                </FormInput>
              </div>

              <UserPassword v-model="passwordForm.newPassword" />
              <UserPassword v-model="passwordForm.confirmNewPassword" :isValid="passwordsMatch" isConfirm />

              <p
                v-if="!passwordsMatch && passwordForm.newPassword && passwordForm.confirmNewPassword"
                class="text-sm text-red-600 dark:text-red-400"
              >
                {{ $t('common.auth.passwordsMismatch') }}
              </p>

              <Button
                :disabled="isLoading || !passwordsMatch"
                :loading="isLoading"
                icon="mdi:lock-reset"
                class="w-full"
                @click="handleChangePassword"
              >
                {{ $t('common.auth.changePassword') }}
              </Button>
            </div>
          </Panel>

          <Panel id="2fa-section" :title="$t('profile.twoFactorAuth')">
            <UserQR
              :enabled="is2FAEnabled"
              :otpauthUrl="otpauthUrl"
              :userId="user?.user.id ?? ''"
              @update:enabled="is2FAEnabled = $event"
              @update:otpauthUrl="otpauthUrl = $event"
              @error="onTwoFAError"
            />
          </Panel>

          <Panel id="sessions-section" :title="$t('profile.sessions')" :description="$t('profile.sessionsDescription')">
            <UserSessions
              :sessions="profileForm.sessions"
              :currentSessionId="user?.user.sessionId"
              :isLoading="isLoading"
              @update:sessions="profileForm.sessions = $event"
              @update:isLoading="isLoading = $event"
              @signOut="signOut"
            />
          </Panel>

          <Panel
            id="events-section"
            :title="$t('profile.securityEvents')"
            :description="$t('profile.securityEventsDescription')"
          >
            <UserSecurityEvents />
          </Panel>

          <Panel danger :title="$t('profile.dangerZone')" :description="$t('profile.deactivateAccountDescription')">
            <Button :disabled="isLoading" variant="danger" icon="mdi:account-cancel-outline" @click="confirmDeactivate">
              {{ $t('profile.deactivateAccount') }}
            </Button>
          </Panel>
        </div>

        <div v-show="activeTab === 'notifications'">
          <Panel
            id="notifications-section"
            :title="$t('profile.notifications')"
            :description="$t('profile.notificationsDescription')"
          >
            <UserNotifications
              v-model:allowNotifs="profileForm.allowNotifs"
              v-model:allowEmail="profileForm.allowEmail"
            />
          </Panel>
        </div>

        <div v-show="activeTab === 'activity'" class="space-y-6">
          <Panel :title="$t('profile.statsTitle')">
            <StatsUser
              :followingCount="profileForm.followers"
              :followerCount="profileForm.following"
              :likedArticles="profileForm.likedArticles"
              :commentsCount="profileForm.commentsCount"
              :likesCount="profileForm.likesCount"
              @openDialog="openDialog"
              @updateTab="activityTab = $event"
            />
          </Panel>

          <UserActivity v-model:activeTab="activityTab" />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-header flex justify-center px-4 sm:px-6">
        <Transition
          enterActiveClass="transition duration-200 ease-out"
          enterFromClass="opacity-0 translate-y-2"
          enterToClass="opacity-100 translate-y-0"
          leaveActiveClass="transition duration-150 ease-in"
          leaveFromClass="opacity-100 translate-y-0"
          leaveToClass="opacity-0 translate-y-2"
        >
          <div
            v-if="isDirty"
            class="pointer-events-auto flex items-center gap-3 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur py-2 pl-4 pr-2 shadow-xl"
          >
            <span class="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span class="size-2 rounded-full bg-amber-500 animate-pulse" />
              {{ $t('common.unsavedChanges') }}
            </span>
            <div class="flex items-center gap-1.5">
              <Button size="sm" variant="transparent" :disabled="isLoading" @click="revertChanges">
                {{ $t('common.actions.reset') }}
              </Button>
              <Button size="sm" :disabled="isLoading" :loading="isLoading" @click="updateProfile">
                {{ $t('common.actions.saveChanges') }}
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </Teleport>

    <LazyUserFollowDialog v-model="showDialog" :type="dialogType" />
    <ModalMini ref="deactivateDialog" />
  </main>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'

import type { TabItem } from '~/components/TabNav.vue'

import { hasProfileChanges } from '~/utils/profileChanges'
import { useProfile, type Profile } from '~/composables/useProfile'
import { sectionId, tabForSection, toHandle } from '~/utils/profileSections'

const BIO_MAX_LENGTH = 300

const tabs: TabItem[] = [
  { id: 'profile', labelKey: 'profile.tabs.profile', icon: 'mdi:account-outline' },
  { id: 'security', labelKey: 'profile.tabs.security', icon: 'mdi:shield-lock-outline' },
  { id: 'notifications', labelKey: 'profile.tabs.notifications', icon: 'mdi:bell-outline' },
  { id: 'activity', labelKey: 'profile.tabs.activity', icon: 'mdi:chart-timeline-variant' },
]

const { data: user, signOut } = useAuth()

// `middleware/auth` is the post-login router, not a guard, and nuxt-auth has no global one here.
const localePath = useLocalePath()
if (!user.value) await navigateTo(localePath({ name: 'autorizace' }))

const { saveProfile, changePassword, deactivateAccount } = useProfile()
const { setLocale } = useI18n()
const { formatTime } = useTime()
const { copy, copied } = useClipboard({ legacy: true })
const toast = useToast()
const route = useRoute()
const router = useRouter()
const reducedMotion = usePreferredReducedMotion()
const deactivateDialog = useTemplateRef<ModalMiniRef>('deactivateDialog')
const oldPasswordId = useId()

function setTab(tab: string) {
  return router.replace({ query: { ...route.query, tab }, hash: route.hash })
}

const activeTab = computed<string>({
  get: () => {
    const q = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
    return tabs.some((t) => t.id === q) ? q! : 'profile'
  },
  set: setTab,
})

const isLoading = shallowRef(false)
const showDialog = shallowRef(false)
const dialogType = shallowRef<'followers' | 'followed'>('followers')
const activityTab = shallowRef<'likedArticles' | 'comments'>('likedArticles')
const originalProfile = shallowRef<Profile | null>(null)
const isDirty = shallowRef(false)
const showOldPassword = shallowRef(false)
const otpauthUrl = shallowRef('')
const profileForm = shallowReactive<Profile>({} as Profile)
const passwordForm = shallowReactive({ oldPassword: '', newPassword: '', confirmNewPassword: '' })

const { data: userData, refresh } = await useFetch(`/api/users/${user.value?.user?.id}/account`)

const is2FAEnabled = shallowRef(!!userData.value?.totpSecret)
otpauthUrl.value = userData.value?.otpauthUrl || ''

if (userData.value) {
  const loaded = { ...userData.value, handle: toHandle(userData.value.username) }
  Object.assign(profileForm, loaded)
  originalProfile.value = { ...loaded }
  setLocale(userData.value.language)
}

useSeoMeta({ title: () => `${profileForm.username ?? ''} — ${$t('profile.title')}` })

const handle = computed(() => toHandle(profileForm.username))
const currentLanguage = computed(() => profileForm.language || locales[0]!.value)
const passwordsMatch = computed(
  () => !!passwordForm.newPassword && passwordForm.newPassword === passwordForm.confirmNewPassword,
)
const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const isPasswordOld = computed(() => {
  const changedAt = userData.value?.passwordChangedAt
  return !!changedAt && Date.now() - new Date(changedAt).getTime() > YEAR_MS
})

const formattedCreatedAt = computed(() =>
  profileForm.createdAt ? `${formatDate(profileForm.createdAt)} (${formatTime(profileForm.createdAt, 'short')})` : '',
)

const isChanged = () => hasProfileChanges(profileForm, originalProfile.value)

const { start: clearPulseLater } = useTimeoutFn(
  (el: HTMLElement) => el.classList.remove('animate-section-pulse'),
  1800,
  { immediate: false },
)

// The tab switch has to land before the scroll — panels are `v-show`, and a `display: none`
// target silently ignores `scrollIntoView`.
async function focusSection(section?: string) {
  if (!section) return
  const id = sectionId(section)
  const tab = tabForSection(id)
  if (tab) await setTab(tab)
  await nextTick()

  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth', block: 'center' })
  el.classList.add('animate-section-pulse')
  clearPulseLater(el)
}

const draftKey = computed(() => `profileDraft-${user.value?.user.id}`)
const storedDraft = useLocalStorage<Profile | null>(draftKey, null)
const draft = {
  load: (): Profile | null => {
    if (!storedDraft.value) return null
    const { sessions: _sessions, ...profile } = storedDraft.value
    return profile as Profile
  },
  save: ({ sessions: _sessions, ...profile }: Profile) => (storedDraft.value = profile as Profile),
  clear: () => (storedDraft.value = null),
}

onMounted(() => {
  focusSection(route.hash)

  const stored = draft.load()
  if (stored && hasProfileChanges(stored, originalProfile.value)) {
    Object.assign(profileForm, stored)
    isDirty.value = true
  }
})

watch(() => route.hash, focusSection)

function revertChanges() {
  if (!originalProfile.value) return
  Object.assign(profileForm, originalProfile.value)
  draft.clear()
  isDirty.value = false
  toast.success({ message: $t('common.messages.successGeneral') })
}

function openDialog(type: 'followers' | 'followed') {
  dialogType.value = type
  showDialog.value = true
}

function onTwoFAError(message: string) {
  if (message) toast.error({ message })
}

async function onAvatarUpload() {
  await refresh()
  if (originalProfile.value) originalProfile.value.avatarUrl = profileForm.avatarUrl
  isDirty.value = isChanged()
  if (isDirty.value) draft.save(profileForm)
  else draft.clear()
}

async function updateProfile() {
  isLoading.value = true
  try {
    const response = await saveProfile({
      username: profileForm.username,
      bio: profileForm.bio,
      avatarUrl: profileForm.avatarUrl,
      allowNotifs: profileForm.allowNotifs,
      allowEmail: profileForm.allowEmail,
    })
    Object.assign(profileForm, response)
    await refresh()
    // Keep both copies of the derived handle in step, not just the snapshot's.
    profileForm.handle = toHandle(profileForm.username)
    originalProfile.value = { ...profileForm }
    draft.clear()
    isDirty.value = false
    otpauthUrl.value = userData.value?.otpauthUrl || ''
  } finally {
    isLoading.value = false
  }
}

async function updateLanguage(newLanguage: Language) {
  isLoading.value = true
  try {
    await saveProfile({ language: newLanguage })
    setLocale(newLanguage)
    // Applied immediately rather than via the save bar, so neither copy may fall behind.
    profileForm.language = newLanguage
    if (originalProfile.value) originalProfile.value.language = newLanguage
    isDirty.value = isChanged()
    await refresh()
  } finally {
    isLoading.value = false
  }
}

async function handleChangePassword() {
  if (!passwordsMatch.value) return
  isLoading.value = true
  try {
    await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    // Mutate in place — reassigning the binding would drop the reactive proxy the form is bound to.
    Object.assign(passwordForm, { oldPassword: '', newPassword: '', confirmNewPassword: '' })
  } finally {
    isLoading.value = false
  }
}

async function confirmDeactivate() {
  const answer = await deactivateDialog.value?.ask({
    title: $t('profile.deactivateAccountConfirmTitle'),
    message: $t('profile.deactivateAccountConfirmText'),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.actions.confirm'),
    cancelText: $t('common.actions.cancel'),
    variant: 'danger',
  })
  if (answer === 'ok') await deactivateAccount()
}

async function exportToPDF() {
  isLoading.value = true
  try {
    const response = await fetch('/api/users/pdf')
    if (!response.ok) throw new Error($t('common.messages.operationFailed'))
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const disposition = response.headers.get('Content-Disposition') || ''
    const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    link.href = url
    link.download = encodedFilename ? decodeURIComponent(encodedFilename) : 'topiqu-profile.pdf'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    toast.error({ message: err.message || $t('common.messages.operationFailed') })
  } finally {
    isLoading.value = false
  }
}

watch(
  profileForm,
  (newVal) => {
    isDirty.value = isChanged()
    if (isDirty.value) draft.save(newVal)
  },
  { deep: true },
)
</script>
