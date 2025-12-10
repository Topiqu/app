declare global {
  var googletag: any
}

let isInitialized = false
let cachedClient: any = null
let gptScriptPromise: Promise<void> | null = null

export const useGamAds = () => {
  const fetchClientData = async () => {
    if (cachedClient) return cachedClient

    const hostname = window.location.hostname.replace(/^www\./, '')
    if (!hostname) return null

    try {
      cachedClient = await $fetch(`/api/clients/slug/${hostname}`)
    } catch (e) {
      console.error(e)
    }
    return cachedClient
  }

  const initialize = async () => {
    if (typeof window === 'undefined') return
    if (gptScriptPromise) return gptScriptPromise

    gptScriptPromise = new Promise<void>((resolve) => {
      fetchClientData().then((client) => {
        if (!client?.gamNetworkCode || !client.allowAds || client.plan === 'BASIC') {
          gptScriptPromise = null
          return
        }

        window.googletag = window.googletag || { cmd: [] }

        if (document.getElementById('gpt-script')) {
          isInitialized = true
          resolve()
          return
        }

        const script = document.createElement('script')
        script.id = 'gpt-script'
        script.async = true
        script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
        document.head.appendChild(script)

        script.onload = () => {
          window.googletag.cmd.push(() => {
            window.googletag.pubads().enableSingleRequest()
            window.googletag.pubads().collapseEmptyDivs(true)
            window.googletag.pubads().enableLazyLoad({
              fetchMarginPercent: 200,
              renderMarginPercent: 100,
              mobileScaling: 2.0,
            })

            if (import.meta.dev) {
              // window.googletag.pubads().setForceSafeFrame(true)
            }

            window.googletag.enableServices()
            isInitialized = true
            resolve()
          })
        }

        script.onerror = () => {
          gptScriptPromise = null
          resolve()
        }
      })
    })

    return gptScriptPromise
  }

  const defineSlot = async (
    adUnitPath: string,
    sizes: number[][] | 'fluid',
    slotId: string,
    targeting?: Record<string, string | string[]>,
  ) => {
    await initialize()

    if (!isInitialized || !window.googletag) return

    const client = cachedClient
    if (!client?.gamNetworkCode) return

    window.googletag.cmd.push(() => {
      const cleanPath = adUnitPath.startsWith('/') ? adUnitPath : `/${adUnitPath}`
      const fullPath = `/${client.gamNetworkCode}${cleanPath}`

      const existingSlots = window.googletag.pubads().getSlots()
      const isDefined = existingSlots.some((s: any) => s.getSlotElementId() === slotId)

      if (isDefined) {
        window.googletag.display(slotId)
        return
      }

      const slot = window.googletag.defineSlot(fullPath, sizes, slotId)

      if (!slot) return

      if (targeting) {
        Object.entries(targeting).forEach(([k, v]) => {
          slot.setTargeting(k, v)
        })
      }

      slot.addService(window.googletag.pubads())
      window.googletag.display(slotId)
    })
  }

  const refreshAds = (slots?: any[]) => {
    if (!isInitialized || !window.googletag) return

    window.googletag.cmd.push(() => {
      window.googletag.pubads().refresh(slots)
    })
  }

  const setTargeting = (key: string, value: string | string[]) => {
    if (!isInitialized || !window.googletag) return

    window.googletag.cmd.push(() => {
      window.googletag.pubads().setTargeting(key, value)
    })
  }

  const destroySlots = (slotIds: string[]) => {
    if (!window.googletag) return

    window.googletag.cmd.push(() => {
      const allSlots = window.googletag.pubads().getSlots()
      const slotsToDestroy = allSlots.filter((s: any) => slotIds.includes(s.getSlotElementId()))

      if (slotsToDestroy.length > 0) {
        window.googletag.destroySlots(slotsToDestroy)
      }
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
