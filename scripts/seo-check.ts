/**
 * End-to-end check of the crawler-facing surface of one tenant domain.
 *
 *   bun run seo:check https://pixbo.topiqu.com
 *
 * Fetches as GPTBot throughout, because that is the client that matters: it runs no JavaScript,
 * so anything only present after hydration is invisible to it. Exits non-zero on any failure.
 */
const GPTBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'

const REQUIRED_NODES = ['WebSite', 'Organization', 'WebPage', 'BlogPosting', 'BreadcrumbList', 'Person']

const raw = process.argv[2]
if (!raw) {
  console.error('Usage: bun run seo:check <https://tenant-domain>')
  process.exit(2)
}
const origin = raw.replace(/\/$/, '')

let failed = 0
let warned = 0

const pass = (label: string, detail = '') => console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail && ` — ${detail}`}`)
const fail = (label: string, detail = '') => {
  failed++
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail && ` — ${detail}`}`)
}
const warn = (label: string, detail = '') => {
  warned++
  console.log(`  \x1b[33mWARN\x1b[0m  ${label}${detail && ` — ${detail}`}`)
}
const check = (ok: boolean, label: string, detail = '') => (ok ? pass(label, detail) : fail(label, detail))

const get = async (path: string) => {
  const res = await fetch(`${origin}${path}`, { headers: { 'user-agent': GPTBOT }, redirect: 'follow' })
  return { status: res.status, body: await res.text(), url: res.url }
}

const section = (name: string) => console.log(`\n\x1b[1m${name}\x1b[0m`)

// ── Crawler surfaces ────────────────────────────────────────────────────────
section('Surfaces')

const robots = await get('/robots.txt')
check(robots.status === 200, 'robots.txt reachable', `HTTP ${robots.status}`)
check(/^Sitemap:/im.test(robots.body), 'robots.txt points at a sitemap')
check(/User-agent:\s*OAI-SearchBot/i.test(robots.body), 'answer-engine group present')
check(/User-agent:\s*Google-Extended/i.test(robots.body), 'grounding tokens present')

// A CDN can prepend its own managed groups, so report per bot rather than on a bare `Disallow: /`.
const groups = robots.body.split(/\n(?=User-agent:)/i)
const fullyBlocked = groups
  .filter((g) => /^Disallow:\s*\/\s*$/im.test(g))
  .flatMap((g) => [...g.matchAll(/User-agent:\s*(\S+)/gi)].map((m) => m[1]!))

if (fullyBlocked.includes('*')) fail('wildcard group blocks the whole site')
else pass('wildcard group does not block the site')

const blockedAnswerEngines = fullyBlocked.filter((b) =>
  ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'DuckAssistBot'].some(
    (x) => x.toLowerCase() === b.toLowerCase(),
  ),
)
check(blockedAnswerEngines.length === 0, 'no answer engine is blocked outright', blockedAnswerEngines.join(', '))
if (fullyBlocked.some((b) => /Google-Extended/i.test(b))) {
  warn('Google-Extended is disallowed', 'opts out of Gemini grounding, not only training')
}
if (fullyBlocked.length) console.log(`         blocked outright: ${fullyBlocked.join(', ')}`)

const wildcardGroups = groups.filter((g) => /^User-agent:\s*\*\s*$/im.test(g)).length
if (wildcardGroups > 1) {
  warn(`${wildcardGroups} separate "User-agent: *" groups`, 'a crawler may honour only the first')
}

const sitemap = await get('/sitemap.xml')
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)
check(sitemap.status === 200, 'sitemap.xml reachable', `HTTP ${sitemap.status}`)
check(locs.length > 0, 'sitemap has URLs', `${locs.length} entries`)

const articleUrls = locs.filter((loc) => /\/(clanky|articles)\//.test(loc))
check(articleUrls.length > 0, 'sitemap lists articles', `${articleUrls.length} article URLs`)

const llms = await get('/llms.txt')
check(llms.status === 200, 'llms.txt reachable', `HTTP ${llms.status}`)
check(llms.body.startsWith('# '), 'llms.txt opens with the required H1')
check(/^## Articles/m.test(llms.body), 'llms.txt lists articles')
const mdLinks = [...llms.body.matchAll(/\]\((https?:\/\/[^)]+\.md)\)/g)].map((m) => m[1]!)
check(mdLinks.length > 0, 'llms.txt links markdown variants', `${mdLinks.length} links`)

const rss = await get('/rss.xml')
check(rss.status === 200, 'rss.xml reachable', `HTTP ${rss.status}`)
check(/<item>/.test(rss.body), 'rss.xml has items', `${(rss.body.match(/<item>/g) ?? []).length} items`)

// ── The article itself, as a JavaScript-free crawler sees it ────────────────
if (!articleUrls.length) {
  console.log('\nNo article in the sitemap — skipping page checks.')
  process.exit(failed ? 1 : 0)
}

const target = new URL(articleUrls[0]!)
section(`Article (${target.pathname})`)

const page = await get(target.pathname)
check(page.status === 200, 'article reachable', `HTTP ${page.status}`)

const proseMatch = page.body.match(/class="[^"]*\bprose\b[^"]*"[^>]*>([\s\S]*?)(?=<\/div><\/div>|<script)/)
const paragraphs = (proseMatch?.[1]?.match(/<p[\s>]/g) ?? []).length
check(paragraphs > 0, 'article body is in the server HTML', `${paragraphs} paragraphs`)
if (paragraphs > 0 && paragraphs < 3) warn('body looks unusually short for an article')

const headingIds = (page.body.match(/<h[23] id="[^"]+"/g) ?? []).length
if (headingIds > 0) pass('headings carry anchor ids', `${headingIds} anchors`)
else warn('no heading anchors', 'fine for an article with no subheadings')

const title = page.body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
check(!!title, 'title present', title)
check(!/Topiqu AI Blog/i.test(title), 'title carries the tenant brand, not the platform')

const canonical = page.body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1]
check(canonical === target.href, 'canonical is self-referencing', canonical ?? 'missing')

const description = page.body.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/)?.[1]
check(!!description, 'meta description present')
check(!/Moderní blogovací platforma/i.test(description ?? ''), 'description is not the platform default')

// Strip the payload first: it re-serialises the body, so its copy of an `<h1>` is not a heading.
const rendered = page.body.replace(/<script[\s\S]*?<\/script>/g, '')
const h1Count = (rendered.match(/<h1[\s>]/g) ?? []).length
check(h1Count === 1, 'exactly one h1', `${h1Count} found`)

// ── Structured data ─────────────────────────────────────────────────────────
section('Structured data')

const ld = [...page.body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
check(ld.length > 0, 'JSON-LD present', `${ld.length} block(s)`)

let nodes: Record<string, any>[] = []
try {
  nodes = ld.flatMap((m) => {
    const parsed = JSON.parse(m[1]!)
    return parsed['@graph'] ?? [parsed]
  })
  pass('JSON-LD parses')
} catch (e) {
  fail('JSON-LD parses', (e as Error).message)
}

const typeOf = (node: Record<string, any>) => [node['@type']].flat().filter(Boolean) as string[]
const allTypes = new Set(nodes.flatMap(typeOf))

for (const required of REQUIRED_NODES) {
  check(allTypes.has(required), `graph contains ${required}`)
}

const article = nodes.find((n) => typeOf(n).includes('BlogPosting'))
if (article) {
  check(!!article.datePublished, 'article has datePublished', article.datePublished ?? '')
  check(!!article.author?.['@id'], 'author is an @id reference, not a bare string')
  check(!!(article.isPartOf || article.mainEntityOfPage), 'article links to its WebPage')
  const citations = [article.citation ?? []].flat().length
  if (citations) pass('article carries citations', `${citations} sources`)
  else warn('no citations', 'article was written without research sources')
  if (article.wordCount) pass('article reports wordCount', String(article.wordCount))
}

// Every @id an entity points at should resolve inside the same graph — except the translation
// links, which point at the other locale's document by design.
const CROSS_DOCUMENT = new Set(['translationOfWork', 'workTranslation'])
const ids = new Set(nodes.map((n) => n['@id']).filter(Boolean))
const dangling = nodes.flatMap((node) =>
  Object.entries(node)
    .filter(
      ([k, v]) => !CROSS_DOCUMENT.has(k) && v && typeof v === 'object' && '@id' in v && !ids.has((v as any)['@id']),
    )
    .map(([k, v]) => `${typeOf(node)[0]}.${k} → ${(v as any)['@id']}`),
)
check(dangling.length === 0, 'no dangling @id references', dangling.join(', '))

// ── Markdown variant ────────────────────────────────────────────────────────
section('Markdown variant')

const md = await get(new URL(mdLinks[0]!).pathname)
check(md.status === 200, 'markdown variant reachable', `HTTP ${md.status}`)
check(md.body.startsWith('# '), 'markdown opens with a title')
check(md.body.includes('Source:'), 'markdown links back to the canonical page')

// ── Result ──────────────────────────────────────────────────────────────────
console.log(`\n${failed ? '\x1b[31m' : '\x1b[32m'}${failed} failed\x1b[0m, ${warned} warnings\n`)
process.exit(failed ? 1 : 0)
