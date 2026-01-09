/// <reference types="@types/google-publisher-tag" />

declare global {
  interface Window {
    googletag: typeof googletag
  }
}

interface ClientData {
  gamNetworkCode: string
  allowAds: boolean
  id: string
  plan: string
  category?: string
}

let isInitialized = false
let cachedClient: ClientData | null = null
let gptScriptPromise: Promise<void> | null = null

export const useGamAds = () => {
  const fetchClientData = async () => {
    if (cachedClient) return cachedClient

    const hostname = window.location.hostname.replace(/^www\./, '')
    if (!hostname) return null

    try {
      cachedClient = await $fetch<ClientData>(`/api/clients/slug/${hostname}`)
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
        if (!client?.gamNetworkCode || !client.allowAds) {
          gptScriptPromise = null
          return
        }

        window.googletag = window.googletag || ({ cmd: [] } as any)

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
            const pubads = window.googletag.pubads()

            pubads.enableSingleRequest()
            pubads.collapseEmptyDivs(true)
            pubads.enableLazyLoad({
              fetchMarginPercent: 200,
              renderMarginPercent: 100,
              mobileScaling: 2.0,
            })

            if (client) {
              pubads.setTargeting('client_id', client.id)
              pubads.setTargeting('plan', client.plan)
              if (client.category) {
                pubads.setTargeting('category', client.category)
              }
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
    sizes: googletag.GeneralSize,
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
      const isDefined = existingSlots.some((s) => s.getSlotElementId() === slotId)

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

  const refreshAds = (slots?: googletag.Slot[]) => {
    if (!isInitialized || !window.googletag) return

    window.googletag.cmd.push(() => {
      window.googletag.pubads().refresh(slots)
    })
  }

  const setPageTargeting = (key: string, value: string | string[]) => {
    if (!isInitialized || !window.googletag) return

    window.googletag.cmd.push(() => {
      window.googletag.pubads().setTargeting(key, value)
    })
  }

  const destroySlots = (slotIds: string[]) => {
    if (!window.googletag) return

    window.googletag.cmd.push(() => {
      const allSlots = window.googletag.pubads().getSlots()
      const slotsToDestroy = allSlots.filter((s) => slotIds.includes(s.getSlotElementId()))

      if (slotsToDestroy.length > 0) {
        window.googletag.destroySlots(slotsToDestroy)
      }
    })
  }

  return {
    initialize,
    defineSlot,
    refreshAds,
    setPageTargeting,
    destroySlots,
    get isInitialized() {
      return isInitialized
    },
  }
}
