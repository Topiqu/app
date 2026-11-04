<template>
  <section class="max-w-3xl space-y-5" data-api-keys>
    <UProgress v-if="isPending" :aria-label="$t('common.loading')" />
    <template v-else>
      <div v-if="created" class="space-y-2 rounded-lg border border-success/40 bg-success/5 p-4" role="status">
        <p class="font-medium text-highlighted">
          {{ $t('common.preferences.api.createdTitle', { name: created.name }) }}
        </p>
        <div class="flex items-center gap-2">
          <UInput
            class="min-w-0 flex-1"
            :ui="{ base: 'font-mono' }"
            :modelValue="created.key"
            readonly
            :aria-label="$t('common.preferences.api.label')"
          />
          <UButton
            square
            color="neutral"
            variant="soft"
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            :aria-label="copied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
            @click="copy(created.key)"
          />
        </div>
        <p class="text-xs text-muted">{{ $t('common.preferences.api.shownOnce') }}</p>
      </div>

      <ul v-if="keys.length" class="divide-y divide-default rounded-lg border border-default">
        <li v-for="apiKey in keys" :key="apiKey.id" class="flex items-start justify-between gap-3 p-3">
          <div class="min-w-0 space-y-1">
            <p class="truncate font-medium text-highlighted">{{ apiKey.name }}</p>
            <p class="font-mono text-xs text-muted">{{ apiKey.prefix }}…</p>
            <div class="flex flex-wrap gap-1">
              <UBadge v-for="scope in apiKey.scopes" :key="scope" color="neutral" variant="soft" size="sm">
                {{ $t(`common.preferences.api.scope.${scope}.label`) }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              <template v-if="apiKey.lastUsedAt">
                {{ $t('common.preferences.api.lastUsed') }} <NuxtTime :datetime="apiKey.lastUsedAt" relative />
              </template>
              <template v-else>{{ $t('common.preferences.api.neverUsed') }}</template>
              <template v-if="apiKey.createdBy"> · {{ apiKey.createdBy.username }}</template>
            </p>
          </div>
          <UButton
            size="xs"
            color="error"
            variant="ghost"
            icon="mdi:key-remove"
            class="shrink-0"
            :loading="busy === apiKey.id"
            @click="revoke(apiKey)"
          >
            {{ $t('common.preferences.api.revoke') }}
          </UButton>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">{{ $t('common.preferences.api.empty') }}</p>

      <form
        v-if="keys.length < MAX_API_KEYS"
        class="space-y-4 rounded-lg border border-default p-4"
        @submit.prevent="create"
      >
        <UFormField :label="$t('common.preferences.api.name')" :hint="$t('common.preferences.api.nameHint')">
          <UInput v-model="name" class="w-full" :maxlength="API_KEY_NAME_MAX" :disabled="!available" />
        </UFormField>
        <UFormField :label="$t('common.preferences.api.scopes')">
          <UCheckboxGroup v-model="scopes" :items="scopeItems" :disabled="!available" />
        </UFormField>
        <UButton type="submit" icon="mdi:plus" :loading="busy === 'create'" :disabled="!available || !name.trim()">
          {{ $t('common.preferences.api.generate') }}
        </UButton>
      </form>
      <p v-else class="text-sm text-muted">{{ $t('common.preferences.api.limit', { max: MAX_API_KEYS }) }}</p>

      <p class="flex items-start gap-2 text-xs text-muted">
        <UIcon name="mdi:shield-alert-outline" class="mt-0.5 size-4 shrink-0" />{{
          $t('common.preferences.api.warning')
        }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { ApiKeyScope } from '~~/generated/zenstack/models'

interface ApiKey {
  id: string
  name: string
  prefix: string
  scopes: ApiKeyScope[]
  lastUsedAt: string | null
  createdBy: { username: string } | null
}

defineProps<{ available: boolean }>()

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const { copy, copied } = useClipboard()
const requestFetch = useRequestFetch()

const { data, isPending, refetch } = useQuery({
  key: () => queryKeys.apiKeys.all,
  query: () => requestFetch<{ keys: ApiKey[] }>('/api/api-keys'),
})
const keys = computed(() => data.value?.keys ?? [])

const name = shallowRef('')
const scopes = shallowRef<ApiKeyScope[]>(['READ'])
const created = shallowRef<{ name: string; key: string } | null>(null)
const busy = shallowRef<string | null>(null)

// READ is always granted, so it is shown checked and locked.
const scopeItems = computed(() =>
  API_KEY_SCOPES.map((value) => ({
    value,
    label: t(`common.preferences.api.scope.${value}.label`),
    description: t(`common.preferences.api.scope.${value}.description`),
    disabled: value === 'READ',
  })),
)

const run = async (key: string, task: () => Promise<void>) => {
  if (busy.value) return
  busy.value = key
  try {
    await task()
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.preferences.api.generateFailed')) })
  } finally {
    busy.value = null
  }
}

const create = () =>
  run('create', async () => {
    const result = await $fetch<{ apiKey: ApiKey; key: string }, '/api/api-keys'>('/api/api-keys', {
      method: 'POST',
      body: { name: name.value.trim(), scopes: scopes.value },
    })
    created.value = { name: result.apiKey.name, key: result.key }
    name.value = ''
    scopes.value = ['READ']
    await refetch()
  })

const revoke = async (apiKey: ApiKey) => {
  if (
    !(await confirm({
      title: t('common.preferences.api.revokeTitle', { name: apiKey.name }),
      message: t('common.preferences.api.revokeWarning'),
      icon: 'mdi:key-remove',
      confirmText: t('common.preferences.api.revoke'),
      cancelText: t('common.messages.deleteCancel'),
      variant: 'danger',
    }))
  )
    return
  await run(apiKey.id, async () => {
    await $fetch<unknown, '/api/api-keys/:id'>(`/api/api-keys/${apiKey.id}` as '/api/api-keys/:id', {
      method: 'DELETE',
    })
    await refetch()
  })
}
</script>
