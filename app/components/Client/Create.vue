<template>
  <Modal v-model="open" :title="$t('master.clientCreate.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <!-- Basic Information -->
        <div
          class="flex flex-col gap-6 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30"
        >
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="mdi:information-outline" class="w-5 h-5 text-gray-500" />
            {{ $t('master.clientCreate.sections.basic') }}
          </h3>
          <FormField
            v-model="newClient.name"
            :label="$t('master.clientCreate.fields.name.label')"
            :placeholder="$t('master.clientCreate.fields.name.placeholder')"
            @input="updateDomainFields"
          />
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientCreate.fields.domainType.label')" />
            <FormSelect
              v-model="newClient.domainType"
              :items="[
                { label: $t('master.clientCreate.fields.domainType.options.SUBDOMAIN'), value: 'SUBDOMAIN' },
                { label: $t('master.clientCreate.fields.domainType.options.CUSTOM'), value: 'CUSTOM' },
              ]"
              :showValue="false"
              @update:modelValue="updateDomainFields"
            />
          </div>
          <FormField
            v-if="newClient.domainType === 'SUBDOMAIN'"
            v-model="newClient.domain"
            :label="$t('master.clientCreate.fields.domain.label')"
            :placeholder="subdomainPlaceholder"
            @input="normalizeDomain('domain')"
          />
          <FormField
            v-if="newClient.domainType === 'CUSTOM'"
            v-model="newClient.customDomain"
            :label="$t('master.clientCreate.fields.customDomain.label')"
            :placeholder="customDomainPlaceholder"
            @input="normalizeDomain('customDomain')"
          />
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientCreate.fields.logo.label')" />
            <FileUploader
              :imageUrl="newClient.logoUrl"
              type="client-logo"
              @upload="((newClient.logoUrl = $event.url), (newClient.optimizedUrl = $event.optimizedUrl))"
            />
          </div>
        </div>

        <!-- Targeting & SEO -->
        <div
          class="flex flex-col gap-6 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30"
        >
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="mdi:target" class="w-5 h-5 text-gray-500" />
            {{ $t('master.clientCreate.sections.seo') }}
          </h3>
          <FormField
            v-model="newClient.description"
            type="textarea"
            :label="$t('master.clientCreate.fields.description.label')"
            :placeholder="$t('master.clientCreate.fields.description.placeholder')"
            :maxLength="255"
          />
          <FormField
            v-model="newClient.audience"
            :label="$t('master.clientCreate.fields.audience.label')"
            :placeholder="$t('master.clientCreate.fields.audience.placeholder')"
          />
          <FormField
            v-model="newClient.focus"
            :label="$t('master.clientCreate.fields.focus.label')"
            :placeholder="$t('master.clientCreate.fields.focus.placeholder')"
          />
          <div class="flex flex-col gap-3">
            <FormField
              v-model="keywordsInput"
              type="textarea"
              :label="$t('master.clientCreate.fields.keywords.label')"
              :placeholder="$t('master.clientCreate.fields.keywords.placeholder')"
              @input="updateKeywords"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400 -mt-2">{{
              $t('master.clientCreate.fields.keywords.count', [newClient.keywords.length])
            }}</span>
          </div>
        </div>

        <!-- Admin Account -->
        <div
          class="flex flex-col gap-6 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30"
        >
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="mdi:account-key-outline" class="w-5 h-5 text-gray-500" />
            {{ $t('master.clientCreate.sections.admin') }}
          </h3>
          <FormField
            v-model="newClient.email"
            type="email"
            :label="$t('master.clientCreate.fields.adminEmail.label')"
            :placeholder="$t('master.clientCreate.fields.adminEmail.placeholder')"
          />
          <FormField
            v-model="newClient.username"
            :label="$t('master.clientCreate.fields.adminUsername.label')"
            :placeholder="$t('master.clientCreate.fields.adminUsername.placeholder')"
          />
          <FormField
            v-model="newClient.password"
            type="password"
            :label="$t('master.clientCreate.fields.adminPassword.label')"
            :placeholder="$t('master.clientCreate.fields.adminPassword.placeholder')"
          />
        </div>

        <!-- Subscription & AI Limits -->
        <div
          class="flex flex-col gap-6 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30"
        >
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Icon name="mdi:credit-card-outline" class="w-5 h-5 text-gray-500" />
            {{ $t('master.clientCreate.sections.subscription') }}
          </h3>
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientCreate.fields.plan.label')" />
            <FormSelect
              v-model="newClient.plan"
              :items="[
                { label: 'Basic', value: 'BASIC' },
                { label: 'Pro', value: 'PRO' },
                { label: 'Premium', value: 'PREMIUM' },
                { label: 'Custom', value: 'CUSTOM' },
              ]"
              :showValue="false"
            />
          </div>
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientCreate.fields.generationFrequency.label')" />
            <FormSelect
              v-model="newClient.generationFrequency"
              :items="[
                { label: $t('master.clientEdit.fields.generationFrequency.options.NONE'), value: 'NONE' },
                { label: $t('master.clientEdit.fields.generationFrequency.options.DAILY'), value: 'DAILY' },
                { label: $t('master.clientEdit.fields.generationFrequency.options.WEEKLY'), value: 'WEEKLY' },
              ]"
              :showValue="false"
            />
          </div>
          <FormField
            v-model.number="newClient.tokenLimit"
            type="number"
            :label="$t('master.clientCreate.fields.tokenLimit.label')"
            :placeholder="$t('master.clientCreate.fields.tokenLimit.placeholder')"
            min="0"
          />
        </div>

        <!-- AI Settings -->
        <div
          v-if="newClient.tokenLimit > 0"
          class="flex flex-col gap-6 p-6 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
        >
          <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Icon name="mdi:robot" class="w-5 h-5" />
            {{ $t('master.clientCreate.aiSettings.title') }}
          </h3>
          <FormField
            v-model="newClient.aiUser.name"
            :label="$t('master.clientCreate.aiSettings.name.label')"
            :placeholder="$t('master.clientCreate.aiSettings.name.placeholder')"
            inputClass="bg-white dark:bg-gray-800"
          />
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientCreate.aiSettings.avatar.label')" />
            <FileUploader
              :imageUrl="newClient.aiUser.avatarUrl"
              type="user-avatar"
              :isAiUser="true"
              @upload="newClient.aiUser.avatarUrl = $event.url"
            />
          </div>
          <FormField
            v-model="newClient.aiUser.bio"
            type="textarea"
            :label="$t('master.clientCreate.aiSettings.bio.label')"
            :placeholder="$t('master.clientCreate.aiSettings.bio.placeholder')"
            :maxLength="300"
            inputClass="bg-white dark:bg-gray-800"
          />
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
        <Button variant="neutral" size="lg" @click="close">{{ $t('master.clientCreate.actions.close') }}</Button>
        <Button size="lg" :disabled="!isFormValid" @click="createClient">{{
          $t('master.clientCreate.actions.submit')
        }}</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
const { emitClientCreated } = useClientEvent()
const { t } = useI18n()
const toast = useToast()

const open = defineModel<boolean>()
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

const createClient = async () => {
  if (!isFormValid.value) return
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
        logoUrl: newClient.value.optimizedUrl || newClient.value.logoUrl,
        aiUser: newClient.value.tokenLimit > 0 ? newClient.value.aiUser : undefined,
        domain: newClient.value.domainType === 'SUBDOMAIN' ? newClient.value.domain : newClient.value.customDomain,
        customDomain: undefined,
      },
    })
    const generatedPassword =
      response.user.password && response.user.password !== 'user submitted' ? response.user.password : null
    if (generatedPassword) {
      await Swal.fire({
        title: t('master.clientCreate.messages.clientCreatedTitle'),
        html: `
          <p>${t('master.clientCreate.messages.clientCreatedHtml1')}</p>
          <p class="mt-2">${t('master.clientCreate.messages.clientCreatedHtml2')}</p>
          <input id="generated-password" value="${generatedPassword}" readonly class="w-full p-2 mt-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-900" />
          <button id="copy-password" class="mt-3 px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all transform hover:scale-105">
            ${t('master.clientCreate.messages.copyPassword')}
          </button>
          <p class="mt-2 text-sm text-gray-500">${t('master.clientCreate.messages.clientCreatedHtml3')}</p>
        `,
        icon: 'success',
        confirmButtonText: t('master.clientCreate.messages.ok'),
        confirmButtonColor: '#22c55e',
        didOpen: () => {
          const copyButton = document.getElementById('copy-password')
          copyButton?.addEventListener('click', () => {
            navigator.clipboard.writeText(generatedPassword)
            toast.success({ message: t('master.clientCreate.messages.passwordCopied') })
          })
        },
      })
    } else {
      toast.success({ message: t('master.clientCreate.messages.success') })
    }
    emitClientCreated()
    open.value = false
    Object.assign(newClient.value, initClient())
    keywordsInput.value = ''
  } catch (e: any) {
    toast.error({
      message: e.data?.message || t('master.clientCreate.messages.createFailed'),
    })
  }
}
</script>
