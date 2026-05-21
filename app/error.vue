<template>
  <NuxtLayout name="default">
    <Status
      type="error"
      :title="title"
      :message="message"
      :actionTo="'/'"
      :actionText="t('common.actions.home')"
      :errorCode="status"
      :stackTrace="stack"
      @action="handleClearError"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
  error: Object as () => NuxtError,
})

const { t } = useI18n()

const status = computed(() => props.error?.statusCode ?? props.error?.status ?? 500)
const message = computed(() => props.error?.message ?? '')
const stack = computed(() => (import.meta.dev ? props.error?.stack : undefined))

const errorTitleMap: Record<number, string> = {
  400: 'common.errTypes.badRequest',
  401: 'common.errTypes.unauthorized',
  403: 'common.errTypes.forbidden',
  404: 'common.errTypes.notFound',
  406: 'common.errTypes.notAcceptable',
  409: 'common.errTypes.conflict',
  422: 'common.errTypes.unprocessableEntity',
  429: 'common.errTypes.tooManyRequests',
  500: 'common.errTypes.server',
  503: 'common.errTypes.serviceUnavailable',
  504: 'common.errTypes.gatewayTimeout',
}

const title = computed(() =>
  t(errorTitleMap[status.value] ?? 'common.errTypes.internalError'),
)

if (import.meta.server) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, status.value)
}

useSeoMeta({
  title: () => `${status.value} — ${title.value}`,
  robots: 'noindex, nofollow',
})

const handleClearError = () => clearError({ redirect: '/' })
</script>
