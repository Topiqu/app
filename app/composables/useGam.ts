declare global {
  var googletag: any
}

export const useGamAds = () => {
  let isInitialized = false
  let cachedClient: any = null

  const fetchClientData = async () => {
    if (cachedClient) return cachedClient
    const hostname =
      useRequestURL()
        .hostname?.split(':')[0]
        ?.replace(/^www\./, '') ?? ''
    const { data, error } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))
    if (error.value) return null
    cachedClient = data.value
    return cachedClient
  }

  const initialize = async () => {
    if (import.meta.client && !globalThis.googletag && !isInitialized) {
      const client = await fetchClientData()
      if (!client?.gamNetworkCode || !client.allowAds || client.plan === 'BASIC') return

      const script = document.createElement('script')
      script.async = true
      script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
      document.head.appendChild(script)

      script.onload = () => {
        globalThis.googletag = globalThis.googletag || { cmd: [] }
        googletag.cmd.push(() => {
          googletag.pubads().enableSingleRequest()
          googletag.pubads().collapseEmptyDivs(true)
          googletag.enableServices()
          if (import.meta.dev) {
            googletag.pubads().enableSafeFrame()
          }
          isInitialized = true
        })
      }
    }
  }

  const defineSlot = async (
    adUnitPath: string,
    sizes: number[][],
    slotId: string,
    targeting?: Record<string, string | string[]>,
  ) => {
    if (import.meta.client && globalThis.googletag) {
      const client = await fetchClientData()
      if (!client?.gamNetworkCode || !client.allowAds || client.plan === 'BASIC') return

      googletag.cmd.push(() => {
        const slot = googletag.defineSlot(`${client.gamNetworkCode}${adUnitPath}`, sizes, slotId)
        if (slot) {
          if (targeting) {
            Object.entries(targeting).forEach(([key, value]) => {
              slot.setTargeting(key, value)
            })
          }
          slot.addService(googletag.pubads())
          googletag.display(slotId)
        }
      })
    }
  }

  const refreshAds = () => {
    if (import.meta.client && globalThis.googletag && isInitialized) {
      googletag.cmd.push(() => {
        googletag.pubads().refresh()
      })
    }
  }

  const setTargeting = (key: string, value: string | string[]) => {
    if (import.meta.client && globalThis.googletag) {
      googletag.cmd.push(() => {
        googletag.pubads().setTargeting(key, value)
      })
    }
  }

  return {
    initialize,
    defineSlot,
    refreshAds,
    setTargeting,
    get isInitialized() {
      return isInitialized
    },
  }
}
