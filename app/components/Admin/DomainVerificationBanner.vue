<template>
  <div
    v-if="!clientSite?.domainVerified"
    class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 justify-between"
  >
    <div class="flex items-center gap-3">
      <Icon name="mdi:shield-alert" class="w-6 h-6 text-amber-500 shrink-0" />
      <div>
        <h4 class="font-bold text-amber-800 dark:text-amber-400 text-sm">{{ $t('domainVerification.title') }}</h4>
        <p class="text-sm text-amber-700 dark:text-amber-500/80">
          {{ $t('domainVerification.description', { domain: clientSite?.domain, target: 'topiqu.com' }) }}
        </p>
      </div>
    </div>

    <Button
      variant="neutral"
      class="bg-white dark:bg-slate-800 shadow-sm border border-amber-200 dark:border-amber-500/30 whitespace-nowrap"
      :loading="pending"
      @click="verify"
    >
      {{ $t('domainVerification.verifyBtn', 'Ověřit DNS') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
const pending = shallowRef(false)
const toast = useToast()

const verify = async () => {
  if (!clientSite) return
  pending.value = true

  try {
    const res = await $fetch('/api/admin/verify-domain', { method: 'POST' })
    if (res.verified) {
      toast.success({ message: $t('domainVerification.success') })
      // Auto-reload to hide the banner
      setTimeout(() => window.location.reload(), 1500)
    } else {
      toast.error({ message: $t('domainVerification.notFound') })
    }
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('domainVerification.error') })
  } finally {
    pending.value = false
  }
}
</script>
