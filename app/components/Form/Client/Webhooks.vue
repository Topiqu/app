<template>
  <section class="space-y-5" data-webhooks>
    <UProgress v-if="isPending" :aria-label="$t('common.loading')" />
    <template v-else>
      <div v-if="secret" class="space-y-2 rounded-lg border border-success/40 bg-success/5 p-4" role="status">
        <p class="font-medium text-highlighted">{{ $t('common.webhooks.secretTitle') }}</p>
        <div class="flex items-center gap-2">
          <UInput
            class="min-w-0 flex-1"
            :ui="{ base: 'font-mono' }"
            :modelValue="secret"
            readonly
            :aria-label="$t('common.webhooks.secretTitle')"
          />
          <UButton
            square
            color="neutral"
            variant="soft"
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            :aria-label="copied ? $t('common.webhooks.copied') : $t('common.webhooks.copy')"
            @click="copy(secret)"
          />
        </div>
        <p class="text-xs text-muted">{{ $t('common.webhooks.secretOnce') }}</p>
      </div>

      <ul v-if="webhooks.length" class="divide-y divide-default rounded-lg border border-default">
        <li v-for="webhook in webhooks" :key="webhook.id" class="space-y-2 p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium text-highlighted">{{ webhook.url }}</p>
              <p class="text-xs text-muted">{{ eventLabels(webhook.events) }}</p>
            </div>
            <UBadge :color="statusColor[stateOf(webhook)]" variant="soft" class="shrink-0">
              {{ $t(`common.webhooks.status.${stateOf(webhook)}`) }}
            </UBadge>
          </div>
          <p v-if="webhook.lastDeliveryAt" class="text-xs text-muted">
            {{ $t('common.webhooks.lastDelivery') }} <NuxtTime :datetime="webhook.lastDeliveryAt" relative /> ·
            {{
              webhook.lastStatusCode
                ? $t('common.webhooks.httpStatus', { status: webhook.lastStatusCode })
                : $t('common.webhooks.unreachable')
            }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="mdi:send-outline"
              :loading="busy === `test:${webhook.id}`"
              :disabled="!webhook.active"
              @click="test(webhook.id)"
            >
              {{ $t('common.webhooks.test') }}
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :icon="webhook.active ? 'mdi:pause' : 'mdi:play'"
              :loading="busy === `toggle:${webhook.id}`"
              @click="toggle(webhook)"
            >
              {{ webhook.active ? $t('common.webhooks.disable') : $t('common.webhooks.enable') }}
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="mdi:key-change"
              :loading="busy === `rotate:${webhook.id}`"
              @click="rotate(webhook.id)"
            >
              {{ $t('common.webhooks.rotate') }}
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="mdi:trash-can-outline"
              :loading="busy === `delete:${webhook.id}`"
              @click="remove(webhook.id)"
            >
              {{ $t('common.webhooks.delete') }}
            </UButton>
          </div>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">{{ $t('common.webhooks.empty') }}</p>

      <form
        v-if="webhooks.length < MAX_WEBHOOKS"
        class="space-y-4 rounded-lg border border-default p-4"
        @submit.prevent="add"
      >
        <UFormField :label="$t('common.webhooks.url')" :hint="$t('common.webhooks.urlHint')" :error="urlError">
          <UInput v-model="url" type="url" class="w-full" placeholder="https://hooks.zapier.com/…" />
        </UFormField>
        <UFormField :label="$t('common.webhooks.events')">
          <UCheckboxGroup v-model="events" :items="eventItems" />
        </UFormField>
        <UButton type="submit" icon="mdi:plus" :loading="busy === 'add'" :disabled="!canAdd">
          {{ $t('common.webhooks.add') }}
        </UButton>
      </form>
      <p v-else class="text-sm text-muted">{{ $t('common.webhooks.limit', { max: MAX_WEBHOOKS }) }}</p>

      <p class="flex items-start gap-2 text-xs text-muted">
        <UIcon name="mdi:shield-check-outline" class="mt-0.5 size-4 shrink-0" />{{ $t('common.webhooks.verifyHint') }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
type WebhookState = 'active' | 'paused' | 'disabled'
interface Webhook {
  id: string
  url: string
  events: WebhookEventCode[]
  active: boolean
  disabledAt: string | null
  lastDeliveryAt: string | null
  lastStatusCode: number | null
}
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const { copy, copied } = useClipboard()
const requestFetch = useRequestFetch()

const { data, isPending, refetch } = useQuery({
  key: () => queryKeys.webhooks.all,
  query: () => requestFetch<{ webhooks: Webhook[] }>('/api/webhooks'),
})
const webhooks = computed(() => data.value?.webhooks ?? [])

const url = shallowRef('')
const events = shallowRef<WebhookEventCode[]>(['ARTICLE_PUBLISHED'])
const secret = shallowRef('')
const busy = shallowRef<string | null>(null)

const urlError = computed(() => (url.value && webhookUrlError(url.value) ? t('common.webhooks.invalidUrl') : undefined))
const canAdd = computed(() => !!url.value && !urlError.value && events.value.length > 0)
const eventItems = computed(() =>
  WEBHOOK_EVENTS.map((value) => ({ value, label: t(`common.webhooks.event.${value}`) })),
)
const eventLabels = (codes: WebhookEventCode[]) => codes.map((code) => t(`common.webhooks.event.${code}`)).join(', ')

const stateOf = (webhook: Webhook): WebhookState =>
  webhook.active ? 'active' : webhook.disabledAt ? 'disabled' : 'paused'
const statusColor = { active: 'success', paused: 'neutral', disabled: 'error' } as const

const run = async (key: string, task: () => Promise<void>) => {
  if (busy.value) return
  busy.value = key
  try {
    await task()
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.webhooks.actionFailed')) })
  } finally {
    busy.value = null
  }
}

const add = () =>
  run('add', async () => {
    const created = await $fetch<{ secret: string }, '/api/webhooks'>('/api/webhooks', {
      method: 'POST',
      body: { url: url.value.trim(), events: events.value },
    })
    secret.value = created.secret
    url.value = ''
    await refetch()
  })

const test = (id: string) =>
  run(`test:${id}`, async () => {
    const result = await $fetch<{ ok: boolean; status: number | null }, '/api/webhooks/:id/test'>(
      `/api/webhooks/${id}/test` as '/api/webhooks/:id/test',
      { method: 'POST' },
    )
    const status = result.status
      ? t('common.webhooks.httpStatus', { status: result.status })
      : t('common.webhooks.unreachable')
    toast.add(
      result.ok
        ? { color: 'success', title: t('common.webhooks.testOk'), description: status }
        : { color: 'error', title: t('common.webhooks.testFailed'), description: status },
    )
  })

const toggle = (webhook: Webhook) =>
  run(`toggle:${webhook.id}`, async () => {
    await $fetch<unknown, '/api/webhooks/:id'>(`/api/webhooks/${webhook.id}` as '/api/webhooks/:id', {
      method: 'PATCH',
      body: { active: !webhook.active },
    })
    await refetch()
  })

const rotate = async (id: string) => {
  if (
    !(await confirm({
      title: t('common.webhooks.rotate'),
      message: t('common.webhooks.rotateConfirm'),
      variant: 'danger',
    }))
  )
    return
  await run(`rotate:${id}`, async () => {
    secret.value = (
      await $fetch<{ secret: string }, '/api/webhooks/:id/secret'>(
        `/api/webhooks/${id}/secret` as '/api/webhooks/:id/secret',
        { method: 'POST' },
      )
    ).secret
  })
}

const remove = async (id: string) => {
  if (
    !(await confirm({
      title: t('common.webhooks.delete'),
      message: t('common.webhooks.deleteConfirm'),
      variant: 'danger',
    }))
  )
    return
  await run(`delete:${id}`, async () => {
    await $fetch<unknown, '/api/webhooks/:id'>(`/api/webhooks/${id}` as '/api/webhooks/:id', { method: 'DELETE' })
    await refetch()
  })
}
</script>
