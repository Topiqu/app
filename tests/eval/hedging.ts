// Sentences about the research itself rather than the topic. Eval-only: in prose some of these are
// wanted (a debunk, a status that is itself the news), so nothing in production blocks on them.
const patterns = [
  /nelze\s+(?:\S+\s+){0,3}(?:ověřit|doložit|potvrdit|vydávat|připsat|určit|označit|tvrdit|vyloučit|vyprávět)/i,
  /z\s+(?:dostupných|veřejných)\s+(?:podkladů|zdrojů|informací)/i,
  /(?:není|nebyl[aoy]?|nejsou)\s+(?:\S+\s+){0,2}(?:doložen|potvrzen|ověřen|známo)/i,
  /(?:zdroje|podklady|informace|záznamy)\s+(?:\S+\s+){0,3}(?:neuvádějí|nepotvrzují|nedokládají|neumožňují|neobsahují)/i,
  /(?:nemáme|chybí|neexistuj\S*)\s+(?:\S+\s+){0,2}(?:důkaz|doklad|potvrzení)/i,
  /nepodařilo\s+se\s+(?:\S+\s+){0,2}(?:ověřit|dohledat|zjistit|doložit)/i,
  /modelov\S*\s+(?:příběh|případ|situac|cest)/i,
  /\bcannot\s+be\s+(?:independently\s+)?(?:verified|confirmed|documented)/i,
  /\b(?:has|have|had)\s+not\s+(?:been\s+)?(?:publicly\s+)?(?:confirmed|verified|documented)/i,
  /\bsources?\s+(?:do|does|did)\s+not\s+(?:confirm|show|establish|document)/i,
  /\b(?:no|little)\s+(?:public\s+)?(?:evidence|record|confirmation)\b/i,
  /\bunverified\b/i,
]

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')

export const hedges = (html: string) => [
  ...new Set(
    text(html)
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => patterns.some((pattern) => pattern.test(sentence))),
  ),
]
