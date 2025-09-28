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
  const checks = []

  if (dbUser.emailVerified) {
    score += weights.email
    checks.push({ label: 'Email ověřený', ok: true })
  } else {
    checks.push({ label: 'Email není ověřený', ok: false })
  }

  if (dbUser.totpSecret) {
    score += weights.totp
    checks.push({ label: 'Dvoufaktorová autentizace aktivní', ok: true })
  } else {
    checks.push({ label: 'Nemáš zapnutou 2FA', ok: false })
  }

  let metadata = logs.length > 0 ? logs[0]?.metadata : null
  if (typeof metadata === 'string') metadata = JSON.parse(metadata)

  if (!dbUser.password) {
    score += weights.password
    checks.push({ label: 'Účet bez hesla (Chráněn skrze OAuth)', ok: true })
  } else if (
    metadata &&
    typeof metadata === 'object' &&
    'passwordStrength' in metadata &&
    metadata.passwordStrength >= 3
  ) {
    score += weights.password
    checks.push({ label: 'Heslo má dobrou sílu', ok: true })
  } else if (metadata && typeof metadata === 'object' && 'passwordStrength' in metadata) {
    const partial = weights.password * (Number(metadata.passwordStrength) / 4)
    score += partial
    checks.push({ label: `Síla hesla: ${metadata.passwordStrength}/4`, ok: false })
  } else {
    checks.push({ label: 'Žádná informace o síle hesla', ok: false })
  }

  const countries = new Set(dbUser.sessions.map((s) => s.country).filter(Boolean))
  const lastLoginYearAgo =
    dbUser.lastLogin && new Date(dbUser.lastLogin) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  if (dbUser.sessions.length === 0) {
    checks.push({ label: 'Žádná aktivní session', ok: false })
  } else if (countries.size > 1 || lastLoginYearAgo) {
    score += weights.sessions * 0.5
    checks.push({
      label: countries.size > 1 ? 'Sessions z různých zemí' : 'Poslední login před více než rokem',
      ok: false,
    })
  } else {
    score += weights.sessions
    checks.push({ label: 'Sessions v pořádku', ok: true })
  }

  if (dbUser.bans.length > 0) {
    const penalty = Math.min(weights.bans, dbUser.bans.length * 5)
    score += Math.max(0, weights.bans - penalty)
    checks.push({ label: `Aktivní bany: ${dbUser.bans.length}`, ok: false })
  } else {
    score += weights.bans
    checks.push({ label: 'Žádné aktivní bany', ok: true })
  }

  return { accountHealth: Math.max(0, Math.min(100, Math.round(score))), checks }
})
