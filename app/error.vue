<template>
  <NuxtLayout name="default">
    <Status
      type="error"
      :title="title"
      :message="message"
      :actionText="$t('common.actions.home')"
      :actionTo="'/'"
      :stackTrace="stackTrace"
      :errorCode="statusCode"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
const error = useError()

const statusCode = computed(() => error.value?.statusCode)

const title = computed(() => {
  switch (statusCode.value) {
    case 404:
      return $t('common.errTypes.notFound')
    case 401:
      return $t('common.errTypes.unauthorized')
    case 403:
      return $t('common.errTypes.forbidden')
    case 400:
      return $t('common.errTypes.badRequest')
    case 429:
      return $t('common.errTypes.tooManyRequests')
    case 500:
      return $t('common.errTypes.server')
    case 503:
      return $t('common.errTypes.serviceUnavailable')
    case 409:
      return $t('common.errTypes.conflict')
    case 406:
      return $t('common.errTypes.notAcceptable')
    case 504:
      return $t('common.errTypes.gatewayTimeout')
    case 422:
      return $t('common.errTypes.unprocessableEntity')
    default:
      return $t('common.errTypes.internalError')
  }
})

const message = computed(() => error.value?.message || '')
const stackTrace = computed(() => error.value?.stack || '')
</script>
