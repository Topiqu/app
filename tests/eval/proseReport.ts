// Readable companion to the JSON audit: bun tests/eval/proseReport.ts <prose-result.json>
import { readFileSync, writeFileSync } from 'node:fs'

import { evalTextPrice } from './candidateWriter'

type Article = { title: string; perex: string; content: string }
type Verdict = {
  reverse: boolean
  preferred: string
  explanation: string
  usage?: { inputTokens?: number; outputTokens?: number }
  findings?: Array<{ article: string; quote: string; defect: string; suggestedEdit: string }>
  lostFactsOrConditions?: Array<{ article: string; detail: string }>
}
type Row = {
  stage?: string
  case?: string
  repeat?: number
  draft?: Article
  final?: Article
  review?: {
    approved: boolean
    issues: Array<{ code: string; note: string }>
    resolvedIssues?: Array<{ code: string; note: string }>
  }
  usage?: { model: string; inputTokens?: number; outputTokens?: number }
  verdicts?: Verdict[]
  draftVerdicts?: Verdict[]
  aModel?: string
  bModel?: string
  kind?: string
  seconds?: number
}

const path = process.argv[2]
if (!path || !/prose-[\w-]+\.json$/.test(path)) throw new Error('Pass a prose eval JSON result path')
const run = JSON.parse(readFileSync(path, 'utf8')) as {
  research: string
  judge: string
  calls: number
  reservedUsd: number
  errors: string[]
  results: Row[]
  writerTiers?: string[]
}
const markdown = (html: string) =>
  html
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs, '[$2]($1)')
    .replace(/<h[23][^>]*>/g, '\n\n### ')
    .replace(/<\/h[23]>/g, '\n\n')
    .replace(/<li[^>]*>/g, '\n- ')
    .replace(/<\/(?:p|ul|ol|blockquote)>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
// Total input uses the uncached tariff: provider cache-detail fields are not consistent
// across SDK adapters. Report this explicitly as an estimate, not an invoice.
const cost = (model: string, input = 0, output = 0) => {
  const price = evalTextPrice(model, input)
  return (input * price.input + output * price.output) / 1e6
}
let generationUsd = 0
let judgeUsd = 0
for (const row of run.results) {
  if (row.usage) generationUsd += cost(row.usage.model, row.usage.inputTokens, row.usage.outputTokens)
  for (const verdict of [...(row.verdicts ?? []), ...(row.draftVerdicts ?? [])])
    if (verdict.usage) judgeUsd += cost('claude-haiku-5-5', verdict.usage.inputTokens, verdict.usage.outputTokens)
}
const rows = [
  '# Prose eval — články a hodnocení',
  run.writerTiers
    ? 'Porovnání samotných writerů na stejných podkladech, s aktuálními pravidly a reasoning high. Drafty neprošly revizí. U každého páru se pořadí pro hodnotitele obrací.'
    : 'A = původní writer i kontrola; B = nový writer, původní kontrola; C = původní writer, nová kontrola; D = nový writer i kontrola.',
  'Jde o testovací články na pevných podkladech, nikoli ověření aktuálního práva. Slepé modelové hodnocení vyžaduje lidské posouzení.',
  'Hodnotitel je Haiku, tedy stejná modelová rodina jako redakční kontrola. Jeho preference nejsou nezávislým důkazem kvality.',
  `Volání: ${run.calls}. Konzervativní rezervace: $${run.reservedUsd.toFixed(4)} (není naměřená cena). Provozní chyby: ${run.errors.length}.`,
  `Odhad z naměřených tokenů bez slev za cache: generování a revize $${generationUsd.toFixed(4)}, hodnotitel $${judgeUsd.toFixed(4)}. Nedokončená volání bez usage nejsou zahrnuta. Sazby odpovídají registru eval modelů.`,
]
for (const row of run.results) {
  const article = row.final ?? row.draft
  if (article) {
    rows.push(
      `## ${row.stage} — ${row.final ? 'finální článek' : 'draft'}`,
      `**${article.title}**`,
      article.perex,
      markdown(article.content),
    )
    if (row.seconds != null) rows.push(`Generování: ${row.seconds.toFixed(1)} s.`)
    if (row.review)
      rows.push(
        `Schváleno: ${row.review.approved}.`,
        'Zbývající připomínky:',
        ...row.review.issues.map((issue) => `- ${issue.code}: ${issue.note}`),
        'Vyřešené připomínky:',
        ...(row.review.resolvedIssues ?? []).map((issue) => `- ${issue.code}: ${issue.note}`),
      )
  }
  if (row.verdicts) {
    rows.push(
      `## Slepé srovnání — ${row.case}, opakování ${row.repeat}${row.aModel ? `, ${row.aModel} vs ${row.bModel}` : ''}`,
    )
    for (const [kind, verdicts] of [
      [row.kind === 'draft' ? 'Draft' : 'Finální text', row.verdicts],
      ['Draft', row.draftVerdicts ?? []],
    ] as const)
      for (const verdict of verdicts) {
        rows.push(
          `**${kind}; obrácené pořadí: ${verdict.reverse}; vítěz: ${verdict.preferred === 'tie' ? 'remíza' : (verdict.preferred === 'B') !== verdict.reverse ? (row.bModel ?? 'nová varianta') : (row.aModel ?? 'původní varianta')}**`,
          verdict.explanation,
        )
        rows.push(
          ...(verdict.findings ?? []).map(
            (finding) => `- ${finding.article}: „${finding.quote}“ — ${finding.defect} Návrh: ${finding.suggestedEdit}`,
          ),
        )
        rows.push(
          ...(verdict.lostFactsOrConditions ?? []).map(
            (finding) => `- **Možná ztráta faktu/podmínky (${finding.article}):** ${finding.detail}`,
          ),
        )
      }
  }
}
writeFileSync(path.replace(/\.json$/, '.md'), rows.join('\n\n'))
console.info(path.replace(/\.json$/, '.md'))
