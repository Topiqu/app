import sharp from 'sharp'

const asHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

export const suggestBrandColors = async (bytes: Uint8Array) => {
  const { data, info } = await sharp(bytes, { limitInputPixels: 16_000_000 })
    .resize(80, 80, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, red: 0, green: 0, blue: 0 }))
  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3]! / 255
    if (alpha < 0.5) continue
    const red = data[index]! / 255
    const green = data[index + 1]! / 255
    const blue = data[index + 2]! / 255
    const high = Math.max(red, green, blue)
    const low = Math.min(red, green, blue)
    const difference = high - low
    if (difference < 0.16 || high < 0.18 || high > 0.95) continue
    let hue = 0
    if (high === red) hue = ((green - blue) / difference) % 6
    else if (high === green) hue = (blue - red) / difference + 2
    else hue = (red - green) / difference + 4
    const bucket = buckets[Math.floor((((hue * 60 + 360) % 360) / 360) * buckets.length)]!
    const weight = alpha * difference
    bucket.weight += weight
    bucket.red += data[index]! * weight
    bucket.green += data[index + 1]! * weight
    bucket.blue += data[index + 2]! * weight
  }
  const ranked = buckets
    .map((bucket, index) => ({ ...bucket, index }))
    .filter((bucket) => bucket.weight > 0)
    .sort((a, b) => b.weight - a.weight)
  const selected: typeof ranked = []
  for (const candidate of ranked) {
    if (
      selected.some(
        (other) => Math.min(Math.abs(other.index - candidate.index), 24 - Math.abs(other.index - candidate.index)) < 3,
      )
    )
      continue
    selected.push(candidate)
    if (selected.length === 3) break
  }
  return selected.map((bucket) =>
    asHex(bucket.red / bucket.weight, bucket.green / bucket.weight, bucket.blue / bucket.weight),
  )
}
