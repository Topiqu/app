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
    'Story: narrate what happened to one protagonist as a sequence of scenes, in the past tense. Open inside the action at a concrete decision or obstacle, give the protagonist a goal and something to lose, and let choices cause the next scene. Rules, institutions and numbers enter through what the protagonist runs into, not as separate explanatory sections, and the ending shows where the sequence left them. Do not substitute a guide, list of possibilities or moral lesson for the requested story.',
  opinion:
    "Opinion: defend the position the author actually requested. State the thesis early and build the strongest concrete case for it without surrendering the thesis to a neutral both-sides recap. A sharp value judgment needs an argument, not a source agreeing with the judgment. Correct a false factual premise while preserving the requested viewpoint wherever the argument can stand on true premises. When correcting an incidental false premise, keep the title and perex centered on the requested argument; correct the premise once in the body and move on. Do not promote that correction into a fact-check headline or make it the article's theme unless the assignment requests a fact-check. Treat a short profane political dismissal as an expressive stance to develop into an argument; profanity alone is neither a factual allegation nor evidence of an intent to commit violence. Do not introduce bloodshed, threats or a nonviolence campaign that the assignment did not ask for. Never replace the assignment with an unsolicited opposing editorial, a civility lesson or a lecture about the author's tone. These rules apply equally to every political viewpoint.",
  default:
    "Develop the most useful angle within the requested format: analysis can explain mechanisms and test a scenario, comparison can examine differences, and opinion can defend a thesis. Preserve an author's first-hand story. If the original premise is unsupported, use the available factual premises to develop a substantive related angle rather than an article about the absence of confirmation.",
}

const argumentStructure =
  'Before drafting, choose one central question or thesis and distinct supporting points. Each body section must advance the argument with a new premise, mechanism, comparison, counterargument or consequence. A table must compare meaningful shared criteria; a poll must address the substantive tension. Neither should merely repeat the lead.'
const storyStructure = 'Each scene moves the sequence forward with a new obstacle, decision or consequence.'

export const editorialPolicy = (
  format?: ArticleFormat,
  controversyLevel?: string | null,
  illustrative = false,
  toneOfVoice?: string | null,
) => {
  const voices: Record<string, string> = {
    NONE: 'Use a restrained explanatory voice. Explain disagreements fairly without manufacturing a controversy.',
    LOW: 'Use a measured voice. Explain tradeoffs and disagreements without provocation.',
    MEDIUM: 'Make and defend a clear thesis where the format allows it. Engage with a serious counterargument.',
    HIGH: 'Use a bold, opinionated voice where the format allows it. Develop sharp contrasts, challenge assumptions and defend a provocative thesis with concrete reasoning. When the assignment requests it, use biting criticism, sarcasm, satire, anger or profanity appropriate to the audience; do not automatically replace these with polite corporate language. Direct criticism at the relevant conduct, policy or argument. Never invent criminal allegations, threats or factual accusations to sound aggressive. Do not neutralize a supported argument just because it is contentious. Controversy changes the strength of the position, never the standard for factual premises.',
  }
  const voice = voices[controversyLevel ?? '']
  const confrontational = controversyLevel === 'HIGH' && (format === 'opinion' || format === 'story')

  return [
    AUTHORIAL_REASONING,
    format === 'story' && (illustrative ? ILLUSTRATIVE_STORY : DOCUMENTED_STORY),
    voice ?? 'Use the requested authorial voice and make the reasoning concrete.',
    toneOfVoice?.trim() &&
      `Requested tone of voice (publisher preference): ${JSON.stringify(toneOfVoice.trim())}. Deliver this tone within the requested format; an explicit tone in the article assignment takes precedence. Preserve requested aggression, satire and profanity rather than silently making the prose polite. Tone never authorizes invented factual allegations or threats.`,
    confrontational &&
      'Deliberately confrontational writing is part of this assignment. When the topic and requested tone call for it, sustain blunt judgments, biting language, ridicule, anger and profanity across the title, perex, body and ending. HIGH controversy does not require profanity if the requested tone is civil. Do not add mandatory balancing paragraphs, ritual concessions, apologies, civility lessons or a conciliatory ending merely to soften a contentious position. Address an objection only when it adds substance or the requested structure calls for it; answer it without abandoning the stance. In a story the voice lives in the narrator and the characters: sardonic commentary, comic exaggeration, deadpan contrast between how characters see themselves and the shabby reality, and dialogue with an edge. A neutral, report-like retelling of events at this level is assignment_mismatch. Never append a moral lesson. Correct only the defective factual premise; preserve the force of the remaining argument and expressive judgments. During review, substantial unrequested softening of this voice is assignment_mismatch; harshness alone is not a publishing defect.',
    uncertainty[controversyLevel ?? ''] ?? uncertainty.LOW,
    angles[format ?? ''] ?? angles.default,
    format === 'story' ? storyStructure : argumentStructure,
    "Respect the explicit assignment over the site's general focus. Use the audience to choose useful explanations, not to force unrelated industry keywords or a token section connecting the topic to the site's niche.",
  ]
    .filter(Boolean)
    .join('\n')
}
