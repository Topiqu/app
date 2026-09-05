<template>
  <USlideover v-model:open="open" :title="$t('master.clientCreate.title')">
    <slot :open="open" />

    <template #body>
      <div class="flex flex-col gap-6">
        <!-- Basic Information -->
        <UCard>
          <div class="flex flex-col gap-6">
            <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
              <UIcon size="20" name="mdi:information-outline" />
              {{ $t('master.clientCreate.sections.basic') }}
            </h3>
            <UFormField :label="$t('master.clientCreate.fields.name.label')">
              <UInput
                v-model="newClient.name"
                :placeholder="$t('master.clientCreate.fields.name.placeholder')"
                @input="updateDomainFields"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.domainType.label')">
              <USelectMenu
                v-model="newClient.domainType"
                valueKey="value"
                labelKey="label"
                :searchInput="false"
                :items="[
                  { label: $t('master.clientCreate.fields.domainType.options.SUBDOMAIN'), value: 'SUBDOMAIN' },
                  { label: $t('master.clientCreate.fields.domainType.options.CUSTOM'), value: 'CUSTOM' },
                ]"
                @update:modelValue="updateDomainFields"
              />
            </UFormField>
            <UFormField
              v-if="newClient.domainType === 'SUBDOMAIN'"
              :label="$t('master.clientCreate.fields.subdomain.label')"
            >
              <UInput
                v-model="newClient.domain"
                :placeholder="subdomainPlaceholder"
                @input="normalizeDomain('domain')"
              />
            </UFormField>
            <UFormField
              v-if="newClient.domainType === 'CUSTOM'"
              :label="$t('master.clientCreate.fields.customDomain.label')"
            >
              <UInput
                v-model="newClient.customDomain"
                :placeholder="customDomainPlaceholder"
                @input="normalizeDomain('customDomain')"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.logo.label')">
              <FormClientLogoUploader
                :imageUrl="newClient.logoUrl"
                @upload="((newClient.logoUrl = $event.url), (newClient.optimizedUrl = $event.optimizedUrl))"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- Targeting & SEO -->
        <UCard>
          <div class="flex flex-col gap-6">
            <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
              <UIcon size="20" name="mdi:target" />
              {{ $t('master.clientCreate.sections.seo') }}
            </h3>
            <UFormField :label="$t('master.clientCreate.fields.description.label')">
              <UTextarea
                v-model="newClient.description"
                :placeholder="$t('master.clientCreate.fields.description.placeholder')"
                :maxLength="255"
                autoresize
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.audience.label')">
              <UInput
                v-model="newClient.audience"
                :placeholder="$t('master.clientCreate.fields.audience.placeholder')"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.focus.label')">
              <UInput v-model="newClient.focus" :placeholder="$t('master.clientCreate.fields.focus.placeholder')" />
            </UFormField>
            <div class="flex flex-col gap-3">
              <UFormField :label="$t('master.clientCreate.fields.keywords.label')">
                <UTextarea
                  v-model="keywordsInput"
                  :placeholder="$t('master.clientCreate.fields.keywords.placeholder')"
                  autoresize
                  @input="updateKeywords"
                />
              </UFormField>
              <span class="text-sm text-muted -mt-2">{{
                $t('master.clientCreate.fields.keywords.count', [newClient.keywords.length])
              }}</span>
            </div>
          </div>
        </UCard>

        <!-- Admin Account -->
        <UCard>
          <div class="flex flex-col gap-6">
            <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
              <UIcon size="20" name="mdi:account-key-outline" />
              {{ $t('master.clientCreate.sections.admin') }}
            </h3>
            <UFormField :label="$t('master.clientCreate.fields.adminEmail.label')">
              <UInput
                v-model="newClient.email"
                type="email"
                :placeholder="$t('master.clientCreate.fields.adminEmail.placeholder')"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.adminUsername.label')">
              <UInput
                v-model="newClient.username"
                :placeholder="$t('master.clientCreate.fields.adminUsername.placeholder')"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.adminPassword.label')">
              <UInput
                v-model="newClient.password"
                type="password"
                :placeholder="$t('master.clientCreate.fields.adminPassword.placeholder')"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- Subscription & AI Limits -->
        <UCard>
          <div class="flex flex-col gap-6">
            <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
              <UIcon size="20" name="mdi:credit-card-outline" />
              {{ $t('master.clientCreate.sections.subscription') }}
            </h3>
            <UFormField :label="$t('master.clientCreate.fields.plan.label')">
              <USelectMenu
                v-model="newClient.plan"
                valueKey="value"
                labelKey="label"
                :searchInput="false"
                :items="[
                  { label: 'Basic', value: 'BASIC' },
                  { label: 'Pro', value: 'PRO' },
                  { label: 'Premium', value: 'PREMIUM' },
                  { label: 'Custom', value: 'CUSTOM' },
                ]"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.generationFrequency.label')">
              <USelectMenu
                v-model="newClient.generationFrequency"
                valueKey="value"
                labelKey="label"
                :searchInput="false"
                :items="[
                  { label: $t('master.clientEdit.fields.generationFrequency.options.NONE'), value: 'NONE' },
                  { label: $t('master.clientEdit.fields.generationFrequency.options.DAILY'), value: 'DAILY' },
                  { label: $t('master.clientEdit.fields.generationFrequency.options.WEEKLY'), value: 'WEEKLY' },
                ]"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.fields.tokenLimit.label')">
              <UInputNumber
                v-model="newClient.tokenLimit"
                :placeholder="$t('master.clientCreate.fields.tokenLimit.placeholder')"
                :min="0"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- AI Settings -->
        <UCard v-if="newClient.tokenLimit > 0">
          <div class="flex flex-col gap-6">
            <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
              <UIcon size="20" name="mdi:robot" />
              {{ $t('master.clientCreate.aiSettings.title') }}
            </h3>
            <UFormField :label="$t('master.clientCreate.aiSettings.name.label')">
              <UInput
                v-model="newClient.aiUser.name"
                :placeholder="$t('master.clientCreate.aiSettings.name.placeholder')"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.aiSettings.avatar.label')">
              <FileUploader
                :imageUrl="newClient.aiUser.avatarUrl"
                type="user-avatar"
                :isAiUser="true"
                @upload="newClient.aiUser.avatarUrl = $event.url"
              />
            </UFormField>
            <UFormField :label="$t('master.clientCreate.aiSettings.bio.label')">
              <UTextarea
                v-model="newClient.aiUser.bio"
                :placeholder="$t('master.clientCreate.aiSettings.bio.placeholder')"
                :maxLength="300"
                autoresize
              />
            </UFormField>
          </div>
        </UCard>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end shrink-0">
        <UButton color="neutral" variant="soft" size="lg" @click="close">{{
          $t('master.clientCreate.actions.close')
        }}</UButton>
        <UButton size="lg" :loading="creating" :disabled="!isFormValid || creating" @click="createClient">{{
          $t('master.clientCreate.actions.submit')
        }}</UButton>
      </div>
    </template>
  </USlideover>
  <UModal
    v-model:open="passwordDialogOpen"
    :title="t('master.clientCreate.messages.clientCreatedTitle')"
    :dismissible="false"
  >
    <template #body>
      <div class="space-y-2">
        <p>{{ t('master.clientCreate.messages.clientCreatedHtml1') }}</p>
        <p>{{ t('master.clientCreate.messages.clientCreatedHtml2') }}</p>
        <UFormField :label="t('master.clientCreate.messages.copyPassword')">
          <UFieldGroup class="w-full">
            <UInput :modelValue="passwordDialogValue" readonly class="flex-1" />
            <UButton
              size="sm"
              color="primary"
              variant="solid"
              icon="mdi:content-copy"
              :aria-label="t('master.clientCreate.messages.copyPassword')"
              :title="t('master.clientCreate.messages.copyPassword')"
              @click="copyPassword"
            />
          </UFieldGroup>
        </UFormField>
        <p class="text-sm text-muted">{{ t('master.clientCreate.messages.clientCreatedHtml3') }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="success" :label="t('master.clientCreate.messages.ok')" @click="passwordDialogOpen = false" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { invalidateClients } = useCacheInvalidation()
const { t } = useI18n()
const toast = useToast()

const open = defineModel<boolean>({ default: false })
const passwordDialogOpen = shallowRef(false)
const passwordDialogValue = shallowRef('')
const copyPassword = () => {
  navigator.clipboard.writeText(passwordDialogValue.value)
  toast.add({ color: 'success', title: t('master.clientCreate.messages.passwordCopied') })
}
const keywordsInput = shallowRef<string>('')
const initClient = () => ({
  name: '',
  email: '',
  username: '',
  password: '',
  domain: '',
  customDomain: '',
  domainType: 'SUBDOMAIN' as 'SUBDOMAIN' | 'CUSTOM',
  plan: 'BASIC' as 'BASIC' | 'PRO' | 'PREMIUM' | 'CUSTOM',
  generationFrequency: 'NONE' as 'NONE' | 'DAILY' | 'WEEKLY',
  optimizedUrl: '',
  tokenLimit: 0,
  focus: '',
  keywords: [] as string[],
  description: '',
  logoUrl: '',
  audience: '',
  aiUser: {
    name: '',
    bio: '',
    avatarUrl: '',
  },
})

const newClient = ref(initClient())

const normalizeString = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-.]/g, '')

const subdomainPlaceholder = computed(() =>
  newClient.value.name ? `${normalizeString(newClient.value.name)}.topiqu.com` : '[název-klienta].topiqu.com',
)
const customDomainPlaceholder = computed(() =>
  newClient.value.name ? `blog.${normalizeString(newClient.value.name)}.com` : 'blog.[název-klienta].com',
)

const isFormValid = computed(() => {
  const { name, domain, customDomain, domainType, email, tokenLimit, aiUser } = newClient.value
  if (!name || !email) return false
  if (domainType === 'SUBDOMAIN' && !domain) return false
  if (domainType === 'CUSTOM' && !customDomain) return false
  if (tokenLimit > 0 && !aiUser.name) return false
  return true
})

const normalizeDomain = (field: 'domain' | 'customDomain') => {
  const value = newClient.value[field]
  if (value) newClient.value[field] = normalizeString(value)
}

const updateDomainFields = () => {
  const normalizedName = newClient.value.name ? normalizeString(newClient.value.name) : ''
  newClient.value.domain = normalizedName ? `${normalizedName}.topiqu.com` : ''
  newClient.value.customDomain = normalizedName ? `blog.${normalizedName}.com` : ''
}

const updateKeywords = () => {
  newClient.value.keywords = keywordsInput.value
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

const creating = shallowRef(false)

const createClient = async () => {
  if (!isFormValid.value || creating.value) return
  creating.value = true
  try {
    interface CreateClientResponse {
      user: {
        email: string
        username: string
        id: string
        password?: string
      }
      [key: string]: any
    }
    const response = await $fetch<CreateClientResponse>('/api/clients', {
      method: 'POST',
      body: {
        ...newClient.value,
        keywords: newClient.value.keywords.length ? newClient.value.keywords : undefined,
        logoUrl: newClient.value.logoUrl,
        aiUser: newClient.value.tokenLimit > 0 ? newClient.value.aiUser : undefined,
        domain: newClient.value.domainType === 'SUBDOMAIN' ? newClient.value.domain : newClient.value.customDomain,
        customDomain: undefined,
      },
    })
    const generatedPassword =
      response.user.password && response.user.password !== 'user submitted' ? response.user.password : null
    if (generatedPassword) {
      passwordDialogValue.value = generatedPassword
      passwordDialogOpen.value = true
    } else {
      toast.add({ color: 'success', title: t('master.clientCreate.messages.success') })
    }
    await invalidateClients()
    open.value = false
    Object.assign(newClient.value, initClient())
    keywordsInput.value = ''
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.clientCreate.messages.createFailed') })
  } finally {
    creating.value = false
  }
}
</script>
