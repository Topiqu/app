export function checkPolicyAndScore(
  text: string,
  brandProfile: any,
): { score: number; flags: string[]; passed: boolean } {
  let score = 100
  const flags: string[] = []

  if (brandProfile && brandProfile.dontList && brandProfile.dontList.length > 0) {
    for (const bannedWord of brandProfile.dontList) {
      if (text.toLowerCase().includes(bannedWord.toLowerCase())) {
        flags.push(`Contains banned word: ${bannedWord}`)
        score -= 20
      }
    }
  }

  if (brandProfile && brandProfile.doList && brandProfile.doList.length > 0) {
    for (const desiredWord of brandProfile.doList) {
      if (text.toLowerCase().includes(desiredWord.toLowerCase())) {
        score += 5
      }
    }
  }

  if (text.length > 3000) {
    flags.push('Post is too long for LinkedIn (max 3000 chars recommended).')
    score -= 30
  }

  if (text.length < 50) {
    flags.push('Post is too short.')
    score -= 10
  }

  const threshold = 70
  const passed = score >= threshold && flags.length === 0

  return {
    score: Math.min(score, 100),
    flags,
    passed,
  }
}
