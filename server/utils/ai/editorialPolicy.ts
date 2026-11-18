import type { ControversyLevel } from '~~/shared/utils/controversyLevel'

import { controversyLevelOf } from '~~/shared/utils/controversyLevel'

import { PROSE } from './prose'

/** Shared by the writer and copy desk so an intentional argument survives editing. */
export const AUTHORIAL_REASONING = `
The author may contribute original reasoning: a thesis, comparison, criticism, explanation of a mechanism, or a clearly conditional scenario. Sources establish the factual premises; they need not contain the author's conclusion verbatim. Show the reasoning connecting those premises to the conclusion.
Distinguish reported facts from interpretation and hypothetical consequences in natural language. Introduce a hypothetical assumption once, then explore it without repeating disclaimers. A value judgment or logical argument does not need a citation for every sentence.
Recognize insults, satire, metaphors and rhetorical exaggeration as expressive judgments when the context makes that reading clear. Do not fact-check them as literal factual allegations or demand softer wording solely because they are harsh. Concrete claims about real acts, crimes, motives or affiliations still require factual grounding, even inside a polemic.
Never invent an event, action, quotation, number, private motive or affiliation to make the argument work. A missing search result establishes neither that an event happened nor that it did not happen.
Write about the topic, never about the research behind it. Saying that something cannot be verified, documented or confirmed earns a sentence only when it corrects a specific claim readers are likely to believe, when the unconfirmed status is itself the development being reported, or when authoritative sources conflict. Otherwise leave the unsupported point out.
`.trim()

/** Only an author asking in the editor gets an invented narrative; the author reviews it before publishing. */
export const ILLUSTRATIVE_STORY = `
A story or scenario the assignment asks for that is not the author's own documented case is told as an illustrative narrative in ordinary storytelling language, never introduced through statements about evidence or documentation. Frame it once in the perex, in the story's own voice (a what-if, a scene set-up); the body never contains a sentence explaining what is fictional and what is real. A well-known fictional character the assignment names is already a fictional frame. An invented protagonist is named by role; the story carries no invented names, officials, amounts or dates presented as real. Its invented or fictional characters may speak in invented dialogue; never put invented words in a real person's mouth. The narrated case itself needs no source; only the real rules, places and events it passes through do.
`.trim()

/** Unattended publishing: a story is a real case or it is not a story. */
const DOCUMENTED_STORY =
  'A story tells a real case that the research brief documents. Never invent a protagonist, scene or event. If the brief does not document the case, write an analysis of the process it would have illustrated instead, with a title and lead that say so.'

const attributed = 'Where it helps readers weigh a contested or estimated point, attribute it to its source once.'
// An explicit stance or an opinion format is never overshoot of a restrained level.
const unasked = 'that neither the assignment, the format nor the requested tone asks for'
const TEXTBOOK =
  'a textbook register at this level (commentary about the article itself, third-person should/must instructions, an even-handed ending that takes no side)'

/** MEDIUM and HIGH: the voice is not reserved for opinion pieces. */
const OPINIONATED_FORMATS =
  'The voice shows in every format: in news through the framing, word choice and short commentary after the facts; in a guide through the approach it stands for, named in the title or perex (for example "size it from the heat loss, not the catalogue"), a judgment on each option, and what to avoid and why; in an analysis or comparison through a thesis the last substantive point lands on; in an opinion or story throughout.'

/**
 * The controversy level is the strength of the position; the tone of voice is the wording. Each row also says
 * what the copy desk reports as tone_mismatch, in both directions, and which formats the topic picker favours.
 */
const LEVELS: Record<
  ControversyLevel,
  { voice: string; inEveryFormat?: string; uncertainty: string; mismatch: string; topicFormats?: string }
> = {
  NONE: {
    voice:
      'Use a restrained explanatory voice. Explain disagreements fairly without manufacturing a controversy. Explain how things work and what each option depends on, and leave the choice to the reader: a guide gives the steps and the criteria but never says which option to pick, and an analysis ends on what the evidence shows, not on advice. An explicit stance in the assignment, or an opinion format, overrides this restraint.',
    uncertainty: attributed,
    mismatch: `During review, a verdict, a pick between options, polemic or irony ${unasked} is tone_mismatch; the steps and criteria of a guide are not a verdict.`,
    topicFormats:
      'This blog explains rather than argues: do not choose opinion; prefer a format that explains a mechanism, a process or the options.',
  },
  LOW: {
    voice:
      'Use a measured voice: an experienced practitioner talking to a peer. Be concrete: say which option suits whom, what to avoid and why, and where the facts clearly favour one option, say so plainly and recommend it. Explain real tradeoffs without provocation and take a side only where the facts settle it; no polemic, and irony only when the requested tone asks for it. An explicit stance in the assignment, or an opinion format, overrides this restraint.',
    uncertainty: attributed,
    mismatch: `During review, polemic, ridicule or irony ${unasked} is tone_mismatch, and so are commentary about the article itself, third-person should/must instructions and a comparison of options that never says which suits whom; a recommendation the facts support is not.`,
  },
  MEDIUM: {
    voice:
      'Write as an experienced practitioner talking to a peer, and take a side. State the thesis or verdict plainly at the start, name the side in the title or perex, and keep it to the end. For example, not "Annual plans have advantages and disadvantages." but "An annual plan is an interest-free loan you give the vendor." Criticise rules, decisions and arguments on their merits, with occasional irony: at least one dry, ironic line in the piece and no more than a few. A real tradeoff may get one sentence, then the article lands on its side. Answer an objection only when it is the reader\'s real doubt, in a sentence or two. Ridicule, hyperbole and profanity belong to HIGH; use them here only when the requested tone asks for them.',
    inEveryFormat: OPINIONATED_FORMATS,
    uncertainty:
      'State supported facts plainly. Carry remaining uncertainty inside the argument as a condition, not as a separate caveat.',
    mismatch: `During review, ${TEXTBOOK}, a piece that never says which side it takes, or one without a single ironic line, is tone_mismatch.`,
    topicFormats: 'Opinion suits this blog whenever the topic holds a position worth defending.',
  },
  HIGH: {
    voice:
      'Use a bold, opinionated voice: an experienced practitioner with a sharp tongue. The title states a provocative thesis as a flat claim, not the topic and never hedged with can, may (or their equivalent in the article language) or a question; the opening challenges the usual framing and the piece carries it to a closing punch. Outside news, every section carries at least one sharp line: an ironic contrast, a sarcastic aside or a jab at the decision, institution or argument under criticism. For example, not "Loyalty programmes may not always deliver value." but "A loyalty programme is a discount you pay for up front and redeem never." Irony, sarcasm, satire, ridicule, anger and rhetorical hyperbole are the main tools; use profanity only when the requested tone allows it, appropriate to the audience. Name who is responsible: the institution, policy or decision. Take objections apart instead of conceding them: answer at least one common objection with sarcasm. Never replace this with polite corporate language. Direct criticism at the relevant conduct, policy or argument. Never invent criminal allegations, threats or factual accusations to sound aggressive. Do not neutralize a supported argument just because it is contentious. Controversy changes the strength of the position, never the standard for factual premises.',
    inEveryFormat: OPINIONATED_FORMATS,
    uncertainty:
      'State supported facts plainly and commit to the thesis. Carry remaining uncertainty inside the argument as a condition, never as a hedge that softens the position, and never in the title.',
    mismatch: `During review, ${TEXTBOOK}, a concession that gives the position away, or a piece that reads measured (a title naming the topic or hedging its thesis with can or may, no sarcasm or ridicule in the body, no objection taken apart) is tone_mismatch, unless the assignment asks for restraint.`,
    topicFormats:
      'This blog is deliberately controversial. Prefer opinion whenever the topic holds a position worth defending; the rule against recent formats does not apply to opinion. Choose analysis or comparison only when readers mainly need a mechanism or a side-by-side, and give it a thesis to argue.',
  },
}

/** The topic picker's format preference for a site's controversy level. */
export const topicFormatsFor = (controversyLevel?: string | null) =>
  LEVELS[controversyLevelOf(controversyLevel)].topicFormats

const angles: Record<string, string> = {
  news: 'News: lead with a documented development when one exists. Keep commentary subordinate to reporting and distinguish it from facts; even HIGH controversy does not turn news into an opinion column. A requested tone of voice still shapes the framing, word choice and commentary. If the supposed development is unsupported, write a concise factual background explainer using documented positions and concrete differences. Make the title and lead describe that context honestly, without implying a new event or turning the article into repeated denials.',
  story:
    'Story: narrate what happened to one protagonist as a sequence of scenes, in the past tense. Open inside the action at a concrete decision or obstacle, give the protagonist a goal and something to lose, and let choices cause the next scene. Rules, institutions and numbers enter through what the protagonist runs into, not as separate explanatory sections, and the ending shows where the sequence left them. Do not substitute a guide, list of possibilities or moral lesson for the requested story.',
  opinion:
    "Opinion: defend the position the author actually requested. State the thesis early and build the strongest concrete case for it without surrendering the thesis to a neutral both-sides recap. A sharp value judgment needs an argument, not a source agreeing with the judgment. Correct a false factual premise while preserving the requested viewpoint wherever the argument can stand on true premises. When correcting an incidental false premise, keep the title and perex centered on the requested argument; correct the premise once in the body and move on. Do not promote that correction into a fact-check headline or make it the article's theme unless the assignment requests a fact-check. Treat a short profane political dismissal as an expressive stance to develop into an argument; profanity alone is neither a factual allegation nor evidence of an intent to commit violence. Do not introduce bloodshed, threats or a nonviolence campaign that the assignment did not ask for. Never replace the assignment with an unsolicited opposing editorial, a civility lesson or a lecture about the author's tone. These rules apply equally to every political viewpoint.",
  default:
    "Develop the most useful angle within the requested format: analysis can explain mechanisms and test a scenario, comparison can examine differences, and opinion can defend a thesis. Preserve an author's first-hand story. If the original premise is unsupported, use the available factual premises to develop a substantive related angle rather than an article about the absence of confirmation.",
}

/** Every level: the article talks about its subject, not about itself, and does not lecture. */
const REGISTER =
  'Never describe the article to the reader ("the following comparison", "this section explains"). Do not lecture in the third person ("the investor must", "it is necessary to") or open with textbook definitions: state the fact or the judgment directly, and address the reader when giving a step.'

const argumentStructure =
  'Before drafting, choose one central question or thesis and distinct supporting points. Each body section must advance the argument with a new premise, mechanism, comparison, counterargument or consequence. A table must compare meaningful shared criteria; a poll must address the substantive tension. Neither should merely repeat the lead.'
const storyStructure = 'Each scene moves the sequence forward with a new obstacle, decision or consequence.'

export const editorialPolicy = (
  format?: ArticleFormat,
  controversyLevel?: string | null,
  illustrative = false,
  toneOfVoice?: string | null,
) => {
  const level = controversyLevelOf(controversyLevel)
  const { voice, inEveryFormat, uncertainty, mismatch } = LEVELS[level]
  const confrontational = level === 'HIGH' && (format === 'opinion' || format === 'story')
  const committed = level === 'HIGH' && (format === 'analysis' || format === 'comparison')

  return [
    AUTHORIAL_REASONING,
    format === 'story' && (illustrative ? ILLUSTRATIVE_STORY : DOCUMENTED_STORY),
    voice,
    REGISTER,
    PROSE,
    inEveryFormat,
    toneOfVoice?.trim() &&
      `Requested tone of voice (publisher preference): ${JSON.stringify(toneOfVoice.trim())}. Deliver this tone in every format, within its shape; an explicit tone in the article assignment takes precedence. The tone shapes the wording; how strongly the article takes a side follows the controversy level above. Preserve requested aggression, satire and profanity rather than silently making the prose polite: a tone that asks for profanity carries it through the piece, not as a word or two in otherwise clean prose, and do not soften it with balancing paragraphs or ritual concessions. When the structure presents an opposing view, present it in this voice, never as a concession. Tone never authorizes invented factual allegations or threats.`,
    confrontational &&
      'Deliberately confrontational writing is part of this assignment. When the topic and requested tone call for it, sustain blunt judgments, biting language, ridicule, anger and profanity across the title, perex, body and ending. HIGH controversy does not require profanity if the requested tone is civil. Do not add mandatory balancing paragraphs, ritual concessions, apologies, civility lessons or a conciliatory ending merely to soften a contentious position. Address an objection only when it adds substance or the requested structure calls for it; answer it without abandoning the stance. In a story the voice lives in the narrator and the characters: sardonic commentary, comic exaggeration, deadpan contrast between how characters see themselves and the shabby reality, and dialogue with an edge. A neutral, report-like retelling of events at this level is tone_mismatch. Never append a moral lesson. Correct only the defective factual premise; preserve the force of the remaining argument and expressive judgments. During review, unrequested softening of this voice is tone_mismatch, which the revision restores; harshness alone is not a publishing defect.',
    committed &&
      'This piece argues a position. State the thesis in the title and perex and carry it, and the requested tone, through every section; mechanisms and comparisons serve the thesis rather than replace it. Do not add balancing paragraphs, ritual concessions or a neutral recap that dissolve it. Address an objection only when it adds substance, and answer it. During review, a draft that drops the thesis into a neutral explainer is assignment_mismatch; one that keeps the thesis but loses the requested tone is tone_mismatch; a factual correction is neither.',
    mismatch,
    uncertainty,
    angles[format ?? ''] ?? angles.default,
    format === 'story' ? storyStructure : argumentStructure,
    "Respect the explicit assignment over the site's general focus. Use the audience to choose useful explanations, not to force unrelated industry keywords or a token section connecting the topic to the site's niche.",
  ]
    .filter(Boolean)
    .join('\n')
}
