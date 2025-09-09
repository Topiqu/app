<template>
  <Modal v-model="open" title="Správa klientů">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Název klienta</span>
          <input
            v-model="newClient.name"
            placeholder="Název klienta"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            @input="updateDomainFields"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Typ domény</span>
          <select
            v-model="newClient.domainType"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            @change="updateDomainFields"
          >
            <option value="SUBDOMAIN">Subdoména</option>
            <option value="CUSTOM">Vlastní doména</option>
          </select>
        </label>
        <label v-if="newClient.domainType === 'SUBDOMAIN'" class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Subdoména</span>
          <input
            v-model="newClient.subdomain"
            :placeholder="subdomainPlaceholder"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            @input="normalizeDomain('subdomain')"
          />
        </label>
        <label v-if="newClient.domainType === 'CUSTOM'" class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Vlastní doména</span>
          <input
            v-model="newClient.customDomain"
            :placeholder="customDomainPlaceholder"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            @input="normalizeDomain('customDomain')"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Popis</span>
          <textarea
            v-model="newClient.description"
            placeholder="Popis klienta (max. 255 znaků)"
            maxlength="255"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md resize-y min-h-[100px]"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Logo klienta</span>
          <FileUploader :imageUrl="newClient.logoUrl" type="client-logo" @upload="newClient.logoUrl = $event.url" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Cílová skupina</span>
          <input
            v-model="newClient.audience"
            placeholder="Cílová skupina (např. mladí profesionálové)"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Email admina</span>
          <input
            v-model="newClient.email"
            placeholder="Email admina"
            type="email"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Uživatelské jméno admina</span>
          <input
            v-model="newClient.username"
            placeholder="Uživatelské jméno admina"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Heslo admina</span>
          <input
            v-model="newClient.password"
            placeholder="Heslo (nechte prázdné pro automatické generování)"
            type="password"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Plán</span>
          <select
            v-model="newClient.plan"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <option value="BASIC">Basic</option>
            <option value="PRO">Pro</option>
            <option value="PREMIUM">Premium</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Frekvence generování</span>
          <select
            v-model="newClient.generationFrequency"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <option value="NONE">Žádná</option>
            <option value="DAILY">Denní</option>
            <option value="WEEKLY">Týdenní</option>
          </select>
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Limit tokenů</span>
          <input
            v-model.number="newClient.tokenLimit"
            type="number"
            placeholder="Limit tokenů"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            min="0"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Focus firmy</span>
          <input
            v-model="newClient.focus"
            placeholder="Focus firmy (např. technologie, marketing)"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Klíčová slova</span>
          <textarea
            v-model="keywordsInput"
            placeholder="Klíčová slova (oddělená čárkou, např. seo, marketing, tech)"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md resize-y min-h-[100px]"
            @input="updateKeywords"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">Slova: {{ newClient.keywords.length }}</span>
        </label>
        <div
          v-if="newClient.tokenLimit > 0"
          class="flex flex-col gap-6 p-6 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
        >
          <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Icon name="mdi:robot" class="w-5 h-5" />
            Nastavení AI autora
          </h3>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Jméno AI</span>
            <input
              v-model="newClient.aiUser.name"
              placeholder="Zadejte zde..."
              class="p-3 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all duration-200 shadow-sm"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Avatar AI</span>
            <FileUploader
              :imageUrl="newClient.aiUser.avatarUrl"
              type="user-avatar"
              :isAiUser="true"
              @upload="newClient.aiUser.avatarUrl = $event.url"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Popis AI</span>
            <textarea
              v-model="newClient.aiUser.bio"
              placeholder="Popis AI autora (max. 300 znaků)"
              maxlength="300"
              class="p-3 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all duration-200 shadow-sm resize-y min-h-[100px]"
            />
          </label>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
          @click="close"
        >
          Zavřít
        </button>
        <button
          class="px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!isFormValid"
          @click="createClient"
        >
          Přidat klienta
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
const { emitClientCreated } = useClientEvent()

const open = defineModel<boolean>()
const keywordsInput = shallowRef<string>('')
const initClient = () => ({
  name: '',
  email: '',
  username: '',
  password: '',
  subdomain: '',
  customDomain: '',
  domainType: 'SUBDOMAIN' as 'SUBDOMAIN' | 'CUSTOM',
  plan: 'BASIC' as 'BASIC' | 'PRO' | 'PREMIUM' | 'CUSTOM',
  generationFrequency: 'NONE' as 'NONE' | 'DAILY' | 'WEEKLY',
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
const toast = useToast()

const normalizeString = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-.]/g, '')

const subdomainPlaceholder = computed(() =>
  newClient.value.name ? `${normalizeString(newClient.value.name)}.topiqu.cz` : '[název-klienta].topiqu.cz',
)
const customDomainPlaceholder = computed(() =>
  newClient.value.name ? `blog.${normalizeString(newClient.value.name)}.cz` : 'blog.[název-klienta].cz',
)

const isFormValid = computed(() => {
  const { name, subdomain, customDomain, domainType, email, tokenLimit, aiUser } = newClient.value
  if (!name || !email) return false
  if (domainType === 'SUBDOMAIN' && !subdomain) return false
  if (domainType === 'CUSTOM' && !customDomain) return false
  if (tokenLimit > 0 && !aiUser.name) return false
  return true
})

const normalizeDomain = (field: 'subdomain' | 'customDomain') => {
  const value = newClient.value[field]
  if (value) newClient.value[field] = normalizeString(value)
}

const updateDomainFields = () => {
  const normalizedName = newClient.value.name ? normalizeString(newClient.value.name) : ''
  newClient.value.subdomain = normalizedName ? `${normalizedName}.topiqu.cz` : ''
  newClient.value.customDomain = normalizedName ? `blog.${normalizedName}.cz` : ''
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
        aiUser: newClient.value.tokenLimit > 0 ? newClient.value.aiUser : undefined,
        subdomain: newClient.value.domainType === 'SUBDOMAIN' ? newClient.value.subdomain : undefined,
        customDomain: newClient.value.domainType === 'CUSTOM' ? newClient.value.customDomain : undefined,
      },
    })
    const generatedPassword =
      response.user.password && response.user.password !== 'user submitted' ? response.user.password : null
    if (generatedPassword) {
      await Swal.fire({
        title: 'Klient vytvořen',
        html: `
          <p>Klient byl úspěšně přidán.</p>
          <p class="mt-2">Vygenerované heslo pro admina:</p>
          <input id="generated-password" value="${generatedPassword}" readonly class="w-full p-2 mt-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-900" />
          <button id="copy-password" class="mt-3 px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all transform hover:scale-105">
            Kopírovat heslo
          </button>
          <p class="mt-2 text-sm text-gray-500">Uložte heslo nebo ho pošlete adminovi.</p>
        `,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#22c55e',
        didOpen: () => {
          const copyButton = document.getElementById('copy-password')
          copyButton?.addEventListener('click', () => {
            navigator.clipboard.writeText(generatedPassword)
            toast.success({ message: 'Heslo zkopírováno do schránky' })
          })
        },
      })
    } else {
      toast.success({ message: 'Klient byl úspěšně přidán' })
    }
    emitClientCreated()
    open.value = false
    Object.assign(newClient.value, initClient())
    keywordsInput.value = ''
  } catch (e: any) {
    toast.error({
      message: e.data?.message || 'Nepodařilo se přidat klienta',
    })
  }
}
</script>
