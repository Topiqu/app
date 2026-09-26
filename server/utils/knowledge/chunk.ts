const TARGET_CHARACTERS = 2_000
const MIN_CHARACTERS = 400
const OVERLAP_CHARACTERS = 300

const splitLong = (line: string): string[] => {
  if (line.length <= TARGET_CHARACTERS) return [line]
  const parts: string[] = []
  let current = ''
  for (const sentence of line.match(/[^.!?]+(?:[.!?]+\s*|$)/g) ?? [line]) {
    if (current && current.length + sentence.length > TARGET_CHARACTERS) {
      parts.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) parts.push(current.trim())
  return parts.flatMap((part) =>
    Array.from({ length: Math.ceil(part.length / TARGET_CHARACTERS) }, (_, index) =>
      part.slice(index * TARGET_CHARACTERS, (index + 1) * TARGET_CHARACTERS),
    ),
  )
}

/**
 * Markdown-heading-aware chunks of ~500 tokens. Each chunk is prefixed with the source title and
 * its heading path, so an excerpt like "Starts at $29" still embeds as *Topiqu › Pricing*.
 */
export const chunkKnowledge = (title: string, content: string): string[] => {
  const chunks: string[] = []
  const path: string[] = []
  let chunkPath: string[] = []
  let lines: string[] = []
  let size = 0
  let fresh = 0

  const flush = () => {
    if (!fresh) return
    chunks.push(`${[title, ...chunkPath].join(' › ')}\n\n${lines.join('\n')}`)
    const tail = lines.at(-1)!
    lines = tail.length <= OVERLAP_CHARACTERS ? [tail] : []
    size = lines.length ? tail.length + 1 : 0
    fresh = 0
  }
  const push = (part: string) => {
    if (fresh && size + part.length > TARGET_CHARACTERS) flush()
    if (!fresh) chunkPath = [...path]
    lines.push(part)
    size += part.length + 1
    fresh += part.length + 1
  }

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      if (fresh >= MIN_CHARACTERS) {
        flush()
        lines = []
        size = 0
      }
      path.splice(heading[1]!.length - 1, Infinity, heading[2]!)
    } else if (line) splitLong(line).forEach(push)
  }
  flush()
  return chunks
}
