type Success = { success: true; city: string; region: string; country: string }
type Fail = { success: false }

export const resolveGeo = async (ip: string) => {
  if (!ip || ip === '::1' || ip.startsWith('127.')) return { city: null, region: null, country: null }

  try {
    const data = await $fetch<Success | Fail>(`https://ipwho.is/${ip}`)
    if (!data.success) return { city: null, region: null, country: null }

    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country ?? null,
    }
  } catch {
    return { city: null, region: null, country: null }
  }
}
