/// <reference types="@types/google-publisher-tag" />
import type { PublicClientSite } from '~~/shared/utils/clientSiteFields'

declare global {
  interface Window {
    googletag: typeof googletag
  }
}

export interface GamSizeMapping {
  viewport: [number, number]
  sizes: googletag.GeneralSize
}

type GamSite = Pick<PublicClientSite, 'id' | 'plan' | 'gamNetworkCode'>

// GPT boots once per page load and every slot waits on the same promise; a failed load is retried by the next slot.
let ready: Promise<boolean> | null = null

const loadGpt = (site: GamSite) =>
  new Promise<boolean>((resolve) => {
    window.googletag ||= { cmd: [] } as unknown as typeof googletag
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    script.onerror = () => resolve(false)
    script.onload = () =>
      window.googletag.cmd.push(() => {
        const pubads = window.googletag.pubads()
        pubads.enableSingleRequest()
        pubads.collapseEmptyDivs(true)
        pubads.enableLazyLoad({ fetchMarginPercent: 200, renderMarginPercent: 100, mobileScaling: 2.0 })
        pubads.setTargeting('client_id', site.id)
        pubads.setTargeting('plan', site.plan)
        window.googletag.enableServices()
        resolve(true)
      })
    document.head.appendChild(script)
  })

export const useGamAds = (site: GamSite | null) => {
  const initialize = () => {
    if (!import.meta.client || !site?.gamNetworkCode) return Promise.resolve(false)
    ready ??= loadGpt(site).then((ok) => {
      if (!ok) ready = null
      return ok
    })
    return ready
  }

  const defineSlot = async (
    adUnitPath: string,
    sizes: googletag.GeneralSize,
    slotId: string,
    targeting?: Record<string, string | string[]>,
    sizeMapping?: GamSizeMapping[],
  ) => {
    if (!(await initialize())) return false

    window.googletag.cmd.push(() => {
      const tag = window.googletag
      if (
        tag
          .pubads()
          .getSlots()
          .some((s) => s.getSlotElementId() === slotId)
      )
        return tag.display(slotId)

      const slot = tag.defineSlot(`/${site!.gamNetworkCode}/${adUnitPath.replace(/^\//, '')}`, sizes, slotId)
      if (!slot) return
      if (sizeMapping?.length) {
        const builder = tag.sizeMapping()
        for (const entry of sizeMapping) builder.addSize(entry.viewport, entry.sizes)
        const mapping = builder.build()
        if (mapping) slot.defineSizeMapping(mapping)
      }
      for (const [key, value] of Object.entries(targeting ?? {})) slot.setTargeting(key, value)
      slot.addService(tag.pubads())
      tag.display(slotId)
    })
    return true
  }

  const destroySlots = (slotIds: string[]) => {
    if (!window.googletag) return
    window.googletag.cmd.push(() => {
      const slots = window.googletag
        .pubads()
        .getSlots()
        .filter((s) => slotIds.includes(s.getSlotElementId()))
      if (slots.length) window.googletag.destroySlots(slots)
    })
  }

  return { initialize, defineSlot, destroySlots }
}
