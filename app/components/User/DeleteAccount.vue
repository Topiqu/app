<template>
  <div>
    <UButton color="error" variant="soft" icon="mdi:account-remove-outline" @click="start">
      {{ $t('profile.deleteAccount.action') }}
    </UButton>

    <UModal
      v-model:open="open"
      scrollable
      :dismissible="!busy"
      :title="$t('profile.deleteAccount.title')"
      :description="preview ? $t('profile.deleteAccount.description', { days: preview.graceDays }) : undefined"
    >
      <template #body>
        <div v-if="result" class="space-y-3" role="status">
          <p class="text-sm leading-6 text-toned">
            {{
              result.status === 'scheduled'
                ? $t('profile.deleteAccount.scheduled', { date: scheduledDate })
                : $t('profile.deleteAccount.confirmationSent', { email: preview?.email })
            }}
          </p>
        </div>

        <div v-else-if="loadFailed" class="text-sm text-error" role="alert">
          {{ $t('common.messages.operationFailed') }}
        </div>

        <div v-else-if="!preview" class="space-y-3" aria-busy="true" :aria-label="$t('common.loading')">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-2/3" />
          <USkeleton class="h-9 w-full" />
        </div>

        <form v-else class="space-y-5" @submit.prevent="submit">
          <ul class="list-disc space-y-1.5 pl-5 text-sm leading-6 text-toned">
            <li>{{ $t('profile.deleteAccount.consequences.signOut') }}</li>
            <li>{{ $t('profile.deleteAccount.consequences.removed') }}</li>
            <li>{{ $t('profile.deleteAccount.consequences.articles') }}</li>
            <li>{{ $t('profile.deleteAccount.consequences.kept') }}</li>
          </ul>

          <UAlert
            v-if="contracted"
            color="warning"
            variant="subtle"
            icon="mdi:alert-outline"
            :description="$t('profile.deleteAccount.errors.contracted')"
          />

          <UButton
            type="button"
            color="neutral"
            variant="soft"
            icon="mdi:code-json"
            :loading="exporting"
            @click="$emit('export')"
          >
            {{ $t('profile.exportToJson') }}
          </UButton>

          <section v-if="preview.blogs.length" class="space-y-3">
            <div>
              <h3 class="text-sm font-semibold text-highlighted">{{ $t('profile.deleteAccount.blogs.title') }}</h3>
              <p class="mt-1 text-sm leading-6 text-muted">
                {{ $t('profile.deleteAccount.blogs.description', { days: preview.graceDays }) }}
              </p>
            </div>
            <div v-for="blog in preview.blogs" :key="blog.id" class="space-y-2 rounded-lg border border-default p-3">
              <p class="text-sm font-medium text-highlighted">{{ blog.name }}</p>
              <p v-if="blog.paid" class="text-xs leading-5 text-muted">
                {{ $t('profile.deleteAccount.blogs.subscription') }}
              </p>
              <p v-if="blog.shopifyBilled" class="text-xs leading-5 text-warning">
                {{ $t('profile.deleteAccount.blogs.shopify') }}
              </p>
              <p v-if="blog.otherMembers" class="text-xs leading-5 text-muted">
                {{ $t('profile.deleteAccount.blogs.members', { count: blog.otherMembers }) }}
              </p>
              <UFormField :label="$t('profile.deleteAccount.blogs.confirm', { domain: blog.domain })">
                <UInput
                  v-model="form.blogs[blog.id]"
                  class="w-full"
                  :placeholder="blog.domain"
                  autocomplete="off"
                  spellcheck="false"
                />
              </UFormField>
            </div>
          </section>

          <section v-if="preview.agencies.length" class="space-y-3">
            <div>
              <h3 class="text-sm font-semibold text-highlighted">{{ $t('profile.deleteAccount.agencies.title') }}</h3>
              <p class="mt-1 text-sm leading-6 text-muted">
                {{ $t('profile.deleteAccount.agencies.description', { days: preview.graceDays }) }}
              </p>
            </div>
            <div
              v-for="agency in preview.agencies"
              :key="agency.id"
              class="space-y-1 rounded-lg border border-default p-3"
            >
              <p class="text-sm font-medium text-highlighted">{{ agency.name }}</p>
              <p v-if="agency.paid" class="text-xs leading-5 text-muted">
                {{ $t('profile.deleteAccount.agencies.subscription') }}
              </p>
              <p v-if="agency.otherMembers" class="text-xs leading-5 text-muted">
                {{ $t('profile.deleteAccount.agencies.members', { count: agency.otherMembers }) }}
              </p>
            </div>
          </section>

          <UFormField :label="$t('profile.deleteAccount.emailConfirm', { email: preview.email })">
            <UInput
              v-model="form.email"
              class="w-full"
              type="email"
              :placeholder="preview.email"
              autocomplete="off"
              spellcheck="false"
            />
          </UFormField>

          <UFormField v-if="preview.hasPassword" :label="$t('profile.deleteAccount.password')">
            <UInput v-model="form.password" class="w-full" type="password" autocomplete="current-password" />
          </UFormField>
          <p v-else class="text-sm leading-6 text-muted">{{ $t('profile.deleteAccount.emailProof') }}</p>

          <UFormField v-if="preview.totpEnabled" :label="$t('profile.deleteAccount.totp')">
            <UInput v-model="form.totp" class="w-full" inputmode="numeric" autocomplete="one-time-code" />
          </UFormField>

          <p v-if="errorMessage" class="text-sm text-error" role="alert">{{ errorMessage }}</p>
        </form>
      </template>

      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <template v-if="result">
            <UButton color="neutral" variant="soft" @click="finish">{{ $t('common.actions.close') }}</UButton>
          </template>
          <template v-else>
            <UButton color="neutral" variant="soft" :disabled="busy" @click="open = false">
              {{ $t('common.actions.cancel') }}
            </UButton>
            <UButton color="error" :loading="busy" :disabled="!canSubmit" @click="submit">
              {{ $t('profile.deleteAccount.submit') }}
            </UButton>
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
defineProps<{ exporting?: boolean }>()
defineEmits<{ export: [] }>()

type Preview = {
  email: string
  hasPassword: boolean
  totpEnabled: boolean
  graceDays: number
  contracted: boolean
  blogs: {
    id: string
    name: string
    domain: string
    paid: boolean
    shopifyBilled: boolean
    otherMembers: number
  }[]
  agencies: { id: string; name: string | null; paid: boolean; otherMembers: number }[]
}
type Result = { status: 'scheduled'; scheduledFor: string } | { status: 'confirmation_sent' }

const { locale } = useI18n()
const { signOut } = useAuth()

const open = shallowRef(false)
const busy = shallowRef(false)
const loadFailed = shallowRef(false)
const preview = shallowRef<Preview | null>(null)
const result = shallowRef<Result | null>(null)
const errorMessage = shallowRef('')
const form = reactive({
  email: '',
  password: '',
  totp: '',
  blogs: {} as Record<string, string>,
})

const contracted = computed(() => !!preview.value?.contracted)

// The server repeats every check. This only keeps the button off until the form could succeed.
const canSubmit = computed(() => {
  const data = preview.value
  if (!data || busy.value || contracted.value) return false
  if (form.email.trim().toLowerCase() !== data.email.toLowerCase()) return false
  if (data.blogs.some((blog) => form.blogs[blog.id] !== blog.domain)) return false
  if (data.hasPassword && !form.password) return false
  return !data.totpEnabled || !!form.totp.trim()
})

const scheduledDate = computed(() =>
  result.value?.status === 'scheduled'
    ? new Date(result.value.scheduledFor).toLocaleDateString(locale.value, { dateStyle: 'long' })
    : '',
)

const start = async () => {
  open.value = true
  result.value = null
  errorMessage.value = ''
  loadFailed.value = false
  Object.assign(form, { email: '', password: '', totp: '', blogs: {} })
  preview.value = null
  try {
    preview.value = await $fetch<Preview>('/api/users/deletion')
  } catch {
    loadFailed.value = true
  }
}

const submit = async () => {
  if (!canSubmit.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    result.value = await $fetch<Result>('/api/users/deletion', {
      method: 'POST',
      body: {
        email: form.email,
        blogs: form.blogs,
        password: form.password || undefined,
        totp: form.totp || undefined,
      },
    })
  } catch (error) {
    errorMessage.value = fetchErrorMessage(error, $t('common.messages.operationFailed'))
  } finally {
    busy.value = false
  }
}

const finish = async () => {
  open.value = false
  if (result.value?.status === 'scheduled') await signOut()
}
</script>
