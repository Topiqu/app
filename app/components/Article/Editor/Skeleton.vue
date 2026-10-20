<template>
  <div class="mx-auto w-full max-w-7xl px-4 pb-12" :aria-label="$t('common.loading')" aria-busy="true">
    <div class="-mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div class="flex items-center gap-3"><USkeleton class="size-10" /><USkeleton class="h-6 w-32" /></div>
      <div class="flex gap-2"><USkeleton class="h-10 w-24" /><USkeleton class="h-10 w-32" /></div>
    </div>
    <div class="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div class="min-w-0 space-y-6">
        <div v-for="index in 2" :key="index" class="space-y-2">
          <USkeleton class="h-4 w-28" /><USkeleton class="h-10 w-full" />
        </div>
        <div class="space-y-2"><USkeleton class="h-4 w-40" /><USkeleton class="h-24 w-full" /></div>
        <div class="overflow-hidden rounded-(--topiqu-surface-radius) border border-default">
          <div class="flex gap-3 border-b border-default p-3">
            <USkeleton class="h-9 w-32" /><USkeleton class="h-9 w-1/2" />
          </div>
          <div class="min-h-96 space-y-3 p-4"><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-4/5" /></div>
        </div>
      </div>
      <div class="hidden self-start space-y-5 rounded-(--topiqu-surface-radius) border border-default p-5 xl:block">
        <USkeleton class="h-10 w-full" /><USkeleton class="h-4 w-28" /><USkeleton class="h-28 w-full" />
        <USkeleton class="h-10 w-32" /><USkeleton class="h-4 w-24" /><USkeleton class="h-10 w-full" />
        <USkeleton class="h-10 w-full" />
      </div>
    </div>
  </div>
</template>
