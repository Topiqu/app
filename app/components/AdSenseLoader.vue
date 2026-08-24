<script setup lang="ts">
const props = defineProps<{ enabled: boolean }>()
const publisherId = String(useRuntimeConfig().public.adsensePublisherId || '').trim()

useHead(() =>
  props.enabled && publisherId
    ? {
        meta: [{ key: 'adsense-account', name: 'google-adsense-account', content: publisherId }],
        script: [
          {
            key: 'adsense-script',
            async: true,
            crossorigin: 'anonymous',
            src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`,
          },
        ],
      }
    : {},
)
</script>
