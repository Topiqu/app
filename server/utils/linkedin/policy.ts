export function checkPolicyAndScore(text: string): { score: number; flags: string[]; passed: boolean } {
  let score = 100
  const flags: string[] = []

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
