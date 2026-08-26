<template>
  <UModal
    v-model:open="open"
    :dismissible="!creating"
    :title="$t('common.tenant.createTitle')"
    :description="$t('common.tenant.createDescription')"
  >
    <template #body>
      <div class="flex flex-col gap-5">
        <UFormField :label="$t('common.tenant.name')">
          <UInput v-model="form.name" autofocus :placeholder="$t('common.tenant.namePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="$t('common.tenant.subdomain')">
          <UFieldGroup class="w-full">
            <UInput
              :modelValue="form.subdomain"
              class="min-w-0 flex-1"
              :placeholder="$t('common.tenant.subdomainPlaceholder')"
              @update:modelValue="setSubdomain"
            />
            <UBadge color="neutral" variant="outline" size="lg">.{{ baseDomain }}</UBadge>
          </UFieldGroup>
          <template #help>
            <span v-if="availability === 'checking'" class="text-muted">{{ $t('common.tenant.checking') }}</span>
            <span v-else-if="availability === 'available'" class="text-success">
              {{ $t('common.tenant.available') }}
            </span>
            <span v-else-if="availabilityReason" class="text-error">
              {{ $t(`common.tenant.domainReasons.${availabilityReason}`) }}
            </span>
          </template>
        </UFormField>

        <UFormField :label="$t('common.tenant.language')">
          <USelect
            v-model="form.language"
            :items="languageOptions"
            valueKey="value"
            labelKey="label"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('common.tenant.theme')">
          <div class="grid grid-cols-8 gap-2 sm:grid-cols-10">
            <UButton
              v-for="theme in themes"
              :key="theme"
              type="button"
              square
              color="neutral"
              :variant="form.theme === theme ? 'outline' : 'ghost'"
              :style="{ backgroundColor: themeColors[theme] }"
              :aria-label="theme"
              :aria-pressed="form.theme === theme"
              @click="form.theme = theme"
            />
          </div>
        </UFormField>

        <UAlert
          color="neutral"
          variant="soft"
          icon="i-mdi-information-outline"
          :title="$t('common.tenant.basicTitle')"
          :description="$t('common.tenant.basicDescription')"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="soft" :disabled="creating" @click="open = false">
          {{ $t('common.close') }}
        </UButton>
        <UButton icon="i-mdi-plus" :loading="creating" :disabled="!canCreate" @click="createTenant">
          {{ $t('common.tenant.createAction') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ThemeSchema } from '~~/shared/zod/enums/Theme.schema'

import { themeColors, type ThemeKey } from '~/composables/theme'

type Availability = 'idle' | 'checking' | 'available' | 'unavailable'
type DomainReason = 'empty' | 'tooShort' | 'invalid' | 'reserved' | 'taken'

const open = defineModel<boolean>({ default: false })
const { locale } = useI18n()
const { getSession } = useAuth()
const toast = useToast()
const config = useRuntimeConfig()
const baseDomain = String(config.public.baseDomain || 'topiqu.com')
const themes = ThemeSchema.options
const form = reactive({
  name: '',
  subdomain: '',
  language: (locale.value === 'cs' ? 'cs' : 'en') as 'cs' | 'en',
  theme: 'indigo' as ThemeKey,
})
const domainTouched = shallowRef(false)
const availability = shallowRef<Availability>('idle')
const availabilityReason = shallowRef<DomainReason | null>(null)
const creating = shallowRef(false)

const languageOptions = computed(() => [
  { label: $t('languages.cs'), value: 'cs' },
  { label: $t('languages.en'), value: 'en' },
])

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)

watch(
  () => form.name,
  (name) => {
    if (!domainTouched.value) form.subdomain = slugify(name)
  },
)

const checkAvailability = useDebounceFn(async () => {
  const requested = form.subdomain
  if (!requested) {
    availability.value = 'idle'
    availabilityReason.value = null
    return
  }

  availability.value = 'checking'
  availabilityReason.value = null
  try {
    const result = await $fetch<{ ok: boolean; reason?: DomainReason }>('/api/onboarding/check-domain', {
      query: { domain: requested, type: 'SUBDOMAIN' },
    })
    if (form.subdomain !== requested) return
    availability.value = result.ok ? 'available' : 'unavailable'
    availabilityReason.value = result.ok ? null : (result.reason ?? 'invalid')
  } catch {
    if (form.subdomain !== requested) return
    availability.value = 'unavailable'
    availabilityReason.value = 'invalid'
  }
}, 350)

watch(
  () => form.subdomain,
  () => {
    availability.value = 'idle'
    availabilityReason.value = null
    checkAvailability()
  },
)

watch(open, (value) => {
  if (value) return
  form.name = ''
  form.subdomain = ''
  form.language = locale.value === 'cs' ? 'cs' : 'en'
  form.theme = 'indigo'
  domainTouched.value = false
  availability.value = 'idle'
  availabilityReason.value = null
})

const setSubdomain = (value: string | number) => {
  domainTouched.value = true
  form.subdomain = slugify(String(value))
}

const canCreate = computed(
  () => Boolean(form.name.trim()) && availability.value === 'available' && !creating.value,
)

const createTenant = async () => {
  if (!canCreate.value) return
  creating.value = true
  try {
    await $fetch('/api/tenant', {
      method: 'POST',
      body: {
        name: form.name,
        subdomain: form.subdomain,
        language: form.language,
        theme: form.theme,
      },
    })
    toast.add({ color: 'success', title: $t('common.tenant.created') })
    await getSession()
    window.location.reload()
  } catch (error: any) {
    const code = error?.data?.data?.code
    const key =
      code === 'TENANT_LIMIT_REACHED'
        ? 'limitReached'
        : code === 'SUBDOMAIN_TAKEN'
          ? 'subdomainTaken'
          : code === 'NAME_TAKEN'
            ? 'nameTaken'
            : code === 'RATE_LIMITED'
              ? 'rateLimited'
              : 'failed'
    toast.add({ color: 'error', title: $t(`common.tenant.${key}`) })
    if (code === 'SUBDOMAIN_TAKEN') {
      availability.value = 'unavailable'
      availabilityReason.value = 'taken'
    }
  } finally {
    creating.value = false
  }
}
</script>
