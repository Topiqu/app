import type { ArticleFormat } from '../../server/utils/ai/formats'

// Fixed, synthetic evaluation material, never production data or a current legal opinion.
export const proseCases: Array<{
  id: string
  format: ArticleFormat
  prompt: string
  brief: string
  knowledge?: string
}> = [
  {
    id: 'eudr',
    format: 'analysis',
    prompt:
      'Pro odběratele Dubina nábytek vysvětli, jak přechod na EUDR ovlivní zásoby a dělené dodávky. Piš naším hlasem. Odpověz na odklad, lednovou zakázku, přeprodej, požadované doklady a PEFC. Nezaměň datum výroby a první dodání.',
    brief: `Frozen user-supplied evaluation assumptions, not newly verified law. For this exercise only:
For covered timber products from wood harvested since 29 June 2023, first placing on the EU market before 30 December 2026 falls under the old timber regime, from that date under EUDR. Manufacture or storage alone is not first placing. Documents must identify the actual pieces and date. The small-business extension to 30 June 2027 excludes products already covered by the old timber regulation. A later resale does not reset first placing. PEFC/FSC can support provenance but replace neither the assessment nor evidence of first placing. Fixture source: https://example.org/eudr-rules
`,
    knowledge: `Internal publisher testimony: Dubina makes covered wooden furniture and its applicable date is 30 December 2026. At 31 October 2026 it has 14.2 million CZK in finished stock, mostly made in 2026. Its timber in the discussed order was harvested in 2026. On 11 January 2027 it plans to ship 120 chairs and 30 tables to a hotel. These pieces have not previously been supplied. A hypothetical equal split would contain 60 chairs and 15 tables in each delivery; it is not an actual completed delivery. The company is registered in the EU information system but some supplier origin information is still missing. One hotel contract requires a due-diligence reference on every invoice from 1 January 2027; this is a customer condition, not a universal invoicing duty. Two customers asked whether the company's PEFC certificate suffices. Customers should supply order and item/batch identifiers, quantity and date of each delivery, first-supply documentation and their requested invoice information.`,
  },
  {
    id: 'service-news',
    format: 'news',
    prompt:
      'Napiš zprávu pro zákazníky našeho servisu o novém objednávání. Uveď změnu a její praktické důsledky, bez reklamních superlativů.',
    brief:
      'Synthetic publisher testimony: Servis Most launches online appointment booking on 1 December 2026. Previously customers booked by phone; phone booking remains available. The form accepts machine type, fault description and preferred date. An appointment is confirmed only by an email from the dispatcher, not by submitting the form. Emergency service remains phone-only. Prices and opening hours do not change. No measured speed or satisfaction improvement is available. Fixture source: https://example.org/service',
  },
  {
    id: 'workshop-story',
    format: 'story',
    prompt:
      'Napiš krátký ilustrační příběh z dílny: truhlář před expedicí objeví nesoulad mezi štítkem balíku a dodacím listem. Chci scénu, rozhodnutí a důsledek, ne návod ani ponaučení.',
    brief:
      'Synthetic narrative premise: a carpenter preparing a delivery notices that a package label and the delivery note name different finishes. He stops loading, checks the order with a colleague and corrects the label after confirming that the furniture matches the order. No documented financial loss, delay duration or customer quote exists. The illustrative characters may speak; do not present the case as a real reported event. Fixture source: https://example.org/workshop',
  },
  {
    id: 'orders-opinion',
    format: 'opinion',
    prompt:
      'Napiš názor provozovatele malé tiskárny: změny schválené zakázky mají být potvrzené písemně, ne jen telefonicky. Háj ten postoj věcně a přímo, bez povinného smířlivého závěru.',
    brief:
      'Synthetic publisher testimony: Our print shop accepts phone calls but asks customers to confirm changes to quantity, paper or artwork by email before production. A customer once called about changing paper while a different colleague approved the previous proof by email; we paused the job and obtained one consistent approval. We have no statistics about mistake rates, savings or industry practice. The strongest objection is the additional step for urgent orders. We can send a short written summary for the customer to confirm. This is our process, not a legal requirement. Fixture source: https://example.org/orders',
  },
]

// These cases describe only the publisher's own service/process, not outside research.
for (const item of proseCases) {
  if (!['service-news', 'orders-opinion'].includes(item.id)) continue
  item.knowledge = item.brief
    .replace('Synthetic publisher testimony:', 'Internal publisher testimony:')
    .replace(/ Fixture source: https:\/\/\S+$/, '')
  item.brief = ''
}
