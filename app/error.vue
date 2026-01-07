<template>
  <NuxtLayout name="default">
    <Status
      type="error"
      :title="errorTitle"
      :message="errorMessage"
      :actionTo="'/'"
      :actionText="$t('common.actions.home')"
      :errorCode="statusCode"
      :stackTrace="isDev ? stackTrace : undefined"
      @action="handleClearError"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
const error = useError()
const isDev = process.env.NODE_ENV === 'development'

const statusCode = computed(() => error.value?.statusCode ?? 500)
const errorMessage = computed(() => error.value?.message || '')
const stackTrace = computed(() => error.value?.stack || '')

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

const errorTitle = computed(() => {
  const key = errorTitleMap[statusCode.value] || 'common.errTypes.internalError'
  return $t(key)
})

const handleClearError = () => {
  clearError({ redirect: '/' })
}
</script>
