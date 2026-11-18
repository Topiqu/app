// Diagnostic candidates only: context decides whether a match is actually filler.
const patterns = {
  importance: /(?:je důležité|je třeba zdůraznit|za zmínku stojí|important to note)/giu,
  advice: /(?:je (?:vhodné|užitečné|praktické)|může (?:pomoci|být užitečné))/giu,
  significance: /(?:hraje klíčovou roli|představuje zásadní|má významný dopad)/giu,
  correction: /(?:(?:sám|sam[aoiy]) (?:o sobě )?(?:ne\p{L}+|však)|nejde (?:jen|pouze) o)/giu,
  scenery: /(?:v dnešní (?:dynamické|rychle)|budoucnost ukáže|jedno je však jisté|klíčem k úspěchu)/giu,
  complexity: /(?:problematika je komplexní|záleží na řadě faktorů|individuálně posoudit)/giu,
  metatext: /(?:pojďme se podívat|jak jsme již zmínili|v následující části|tomuto scénáři odpovídá|vysvětlujeme)/giu,
  citation:
    /(?:podrobnosti (?:uvádí|zveřejňuje)|více informací poskytuje|přehled [^.!?]{0,60}(?:zveřejňuje|k dispozici))/giu,
  nominalisation: /(?:provést posouzení|dochází k navýšení|obchodní přínos.{0,12}evidence)/giu,
}

export const prosePhrases = (html: string) => {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  return Object.entries(patterns).flatMap(([category, pattern]) =>
    [...text.matchAll(pattern)].map((match) => ({ category, phrase: match[0], offset: match.index })),
  )
}
