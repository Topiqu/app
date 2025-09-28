export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      sessions: {
        where: { revoked: false },
        orderBy: { lastUsedAt: 'desc' },
      },
      bans: {
        where: { expiresAt: { gt: new Date() } },
      },
    },
  })
  if (!dbUser) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  const logs = await prisma.log.findMany({
    where: { userId: user.id, action: { in: ['PASSWORD_CHANGE', 'PASSWORD_SET'] } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })

  const weights = { email: 20, totp: 25, password: 25, sessions: 15, bans: 15 }

  let score = 0
  const checks: { label: string; ok: boolean }[] = []
  let passwordStrength: number | null = null
  const bansCount: number = dbUser.bans.length

  if (dbUser.emailVerified) {
    score += weights.email
    checks.push({ label: 'profile.checks.emailVerified', ok: true })
  } else {
    checks.push({ label: 'profile.checks.emailNotVerified', ok: false })
  }

  if (dbUser.totpSecret) {
    score += weights.totp
    checks.push({ label: 'profile.checks.2faEnabled', ok: true })
  } else {
    checks.push({ label: 'profile.checks.2faDisabled', ok: false })
  }

  let metadata = logs.length > 0 ? logs[0]?.metadata : null
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    } catch {
      metadata = null
    }
  }

  if (!dbUser.password) {
    score += weights.password
    checks.push({ label: 'profile.checks.noPassword', ok: true })
  } else if (
    metadata &&
    typeof metadata === 'object' &&
    'passwordStrength' in metadata &&
    typeof metadata.passwordStrength === 'number' &&
    metadata.passwordStrength >= 3
  ) {
    score += weights.password
    checks.push({ label: 'profile.checks.passwordStrong', ok: true })
    passwordStrength = metadata.passwordStrength
  } else if (
    metadata &&
    typeof metadata === 'object' &&
    'passwordStrength' in metadata &&
    typeof metadata.passwordStrength === 'number'
  ) {
    score += weights.password * (metadata.passwordStrength / 4)
    checks.push({ label: 'profile.checks.passwordWeak', ok: false })
    passwordStrength = metadata.passwordStrength
  } else {
    checks.push({ label: 'profile.checks.passwordUnknown', ok: false })
  }

  const countries = new Set(dbUser.sessions.map((s) => s.country).filter(Boolean))
  const lastLoginYearAgo =
    dbUser.lastLogin && new Date(dbUser.lastLogin) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  if (dbUser.sessions.length === 0) {
    checks.push({ label: 'profile.checks.noSessions', ok: false })
  } else if (countries.size > 1 || lastLoginYearAgo) {
    score += weights.sessions * 0.5
    checks.push({
      label: countries.size > 1 ? 'profile.checks.sessionsMultipleCountries' : 'profile.checks.lastLoginOld',
      ok: false,
    })
  } else {
    score += weights.sessions
    checks.push({ label: 'profile.checks.sessionsOk', ok: true })
  }

  if (dbUser.bans.length > 0) {
    const penalty = Math.min(weights.bans, dbUser.bans.length * 5)
    score += Math.max(0, weights.bans - penalty)
    checks.push({ label: 'profile.checks.bans', ok: false })
  } else {
    score += weights.bans
    checks.push({ label: 'profile.checks.noBans', ok: true })
  }

  return { accountHealth: Math.max(0, Math.min(100, Math.round(score))), checks, passwordStrength, bansCount }
})
