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

    if (!hostname) return null

    const { data } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))

    cachedClient = data.value
    return cachedClient
  }

  const initialize = async () => {
    if (!import.meta.client) return
    if (isInitialized || globalThis.googletag?.cmd) return

    const client = await fetchClientData()
    if (!client?.gamNetworkCode || !client.allowAds || client.plan === 'BASIC') return

    globalThis.googletag = globalThis.googletag || { cmd: [] }

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    document.head.appendChild(script)

    await new Promise<void>((resolve) => {
      script.onload = () => {
        googletag.cmd.push(() => {
          googletag.pubads().enableSingleRequest()
          googletag.pubads().collapseEmptyDivs(true)
          googletag.pubads().enableLazyLoad({
            fetchMarginPercent: 200,
            renderMarginPercent: 100,
            mobileScaling: 2.0,
          })

          if (import.meta.dev) {
            googletag.pubads().setForceSafeFrame(true)
          }

          googletag.enableServices()
          isInitialized = true
          resolve()
        })
      }

      script.onerror = () => resolve()
    })
  }

  const defineSlot = async (
    adUnitPath: string,
    sizes: number[][] | 'fluid',
    slotId: string,
    targeting?: Record<string, string | string[]>,
  ) => {
    await initialize()

    if (!isInitialized || !globalThis.googletag) return

    const client = cachedClient
    if (!client?.gamNetworkCode) return

    googletag.cmd.push(() => {
      const existingSlot = googletag
        .pubads()
        .getSlots()
        .find((s: any) => s.getSlotElementId() === slotId)

      if (existingSlot) return

      const slot = googletag.defineSlot(`${client.gamNetworkCode}${adUnitPath}`, sizes, slotId)

      if (!slot) return

      if (targeting) {
        Object.entries(targeting).forEach(([k, v]) => {
          slot.setTargeting(k, v)
        })
      }

      slot.addService(googletag.pubads())
      googletag.display(slotId)
    })
  }

  const refreshAds = (slots?: any[]) => {
    if (!isInitialized || !globalThis.googletag) return

    googletag.cmd.push(() => {
      googletag.pubads().refresh(slots)
    })
  }

  const setTargeting = (key: string, value: string | string[]) => {
    if (!isInitialized || !globalThis.googletag) return

    googletag.cmd.push(() => {
      googletag.pubads().setTargeting(key, value)
    })
  }

  const destroySlots = (slots?: any[]) => {
    if (!globalThis.googletag) return

    googletag.cmd.push(() => {
      googletag.destroySlots(slots)
    })
  }

  return {
    initialize,
    defineSlot,
    refreshAds,
    setTargeting,
    destroySlots,
    get isInitialized() {
      return isInitialized
    },
  }
}
