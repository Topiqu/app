import type { ArticleFormat } from './formats'

/** Shared by the writer and copy desk so an intentional argument survives editing. */
export const AUTHORIAL_REASONING = `
The author may contribute original reasoning: a thesis, comparison, criticism, explanation of a mechanism, or a clearly conditional scenario. Sources establish the factual premises; they need not contain the author's conclusion verbatim. Show the reasoning connecting those premises to the conclusion.
Distinguish reported facts from interpretation and hypothetical consequences in natural language. Introduce a hypothetical assumption once, then explore it without repeating disclaimers. A value judgment or logical argument does not need a citation for every sentence.
Never invent an event, action, quotation, number, private motive or affiliation to make the argument work. A missing search result establishes neither that an event happened nor that it did not happen.
Write about the topic, never about the research behind it. Saying that something cannot be verified, documented or confirmed earns a sentence only when it corrects a specific claim readers are likely to believe, when the unconfirmed status is itself the development being reported, or when authoritative sources conflict. Otherwise leave the unsupported point out.
`.trim()

/** Only an author asking in the editor gets an invented narrative; the author reviews it before publishing. */
export const ILLUSTRATIVE_STORY = `
A story or scenario the assignment asks for that is not the author's own documented case is told as an illustrative narrative in ordinary storytelling language, never introduced through statements about evidence or documentation. Say once, in the lead or perex, that the story is illustrative, as part of the storytelling frame rather than as a statement about evidence. Its protagonist is named by role; it carries no invented names, officials, amounts or dates presented as real. The narrated case itself needs no source; only the real rules, places and events it passes through do.
`.trim()

/** Unattended publishing: a story is a real case or it is not a story. */
const DOCUMENTED_STORY =
  'A story tells a real case that the research brief documents. Never invent a protagonist, scene or event. If the brief does not document the case, write an analysis of the process it would have illustrated instead, with a title and lead that say so.'

/** How uncertainty reads at each controversy level; the exceptions above apply to all of them. */
const attributed = 'Where it helps readers weigh a contested or estimated point, attribute it to its source once.'
const uncertainty: Record<string, string> = {
  NONE: attributed,
  LOW: attributed,
  MEDIUM:
    'State supported facts plainly. Carry remaining uncertainty inside the argument as a condition, not as a separate caveat.',
  HIGH: 'State supported facts plainly and commit to the thesis. Carry remaining uncertainty inside the argument as a condition, never as a hedge that softens the position.',
}

const angles: Record<string, string> = {
  news: 'News: lead with a documented development when one exists. Keep commentary subordinate to reporting and distinguish it from facts; even HIGH controversy does not turn news into an opinion column. If the supposed development is unsupported, write a concise factual background explainer using documented positions and concrete differences. Make the title and lead describe that context honestly, without implying a new event or turning the article into repeated denials.',
  story:
    'Story: narrate what happened to one protagonist as a sequence of scenes, in the past tense. Rules, institutions and numbers enter through what the protagonist runs into, not as separate explanatory sections, and the ending shows where the sequence left them.',
  default:
    "Develop the most useful angle within the requested format: analysis can explain mechanisms and test a scenario, comparison can examine differences, and opinion can defend a thesis. Preserve an author's first-hand story. If the original premise is unsupported, use the available factual premises to develop a substantive related angle rather than an article about the absence of confirmation.",
}

const argumentStructure =
  'Before drafting, choose one central question or thesis and distinct supporting points. Each body section must advance the argument with a new premise, mechanism, comparison, counterargument or consequence. A table must compare meaningful shared criteria; a poll must address the substantive tension. Neither should merely repeat the lead.'
const storyStructure = 'Each scene moves the sequence forward with a new obstacle, decision or consequence.'

export const editorialPolicy = (format?: ArticleFormat, controversyLevel?: string | null, illustrative = false) => {
  const voices: Record<string, string> = {
    NONE: 'Use a restrained explanatory voice. Explain disagreements fairly without manufacturing a controversy.',
    LOW: 'Use a measured voice. Explain tradeoffs and disagreements without provocation.',
    MEDIUM: 'Make and defend a clear thesis where the format allows it. Engage with a serious counterargument.',
    HIGH: 'Use a bold, opinionated voice where the format allows it. Develop sharp contrasts, challenge assumptions and defend a provocative thesis with concrete reasoning. Do not neutralize a supported argument just because it is contentious. Controversy changes the strength of the position, never the standard for factual premises.',
  }
  const voice = voices[controversyLevel ?? '']

  return [
    AUTHORIAL_REASONING,
    illustrative ? ILLUSTRATIVE_STORY : format === 'story' && DOCUMENTED_STORY,
    voice ?? 'Use the requested authorial voice and make the reasoning concrete.',
    uncertainty[controversyLevel ?? ''] ?? uncertainty.LOW,
    angles[format ?? ''] ?? angles.default,
    format === 'story' ? storyStructure : argumentStructure,
    "Respect the explicit assignment over the site's general focus. Use the audience to choose useful explanations, not to force unrelated industry keywords or a token section connecting the topic to the site's niche.",
  ]
    .filter(Boolean)
    .join('\n')
}
