import { execSync } from 'node:child_process'

export default defineEventHandler(() => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const run = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      return ''
    }
  }

  const toWebUrl = (remote: string) => {
    if (!remote) return ''
    const cleaned = remote.replace(/\.git$/, '')
    const ssh = cleaned.match(/^git@([^:]+):(.+)$/)
    if (ssh) return `https://${ssh[1]}/${ssh[2]}`
    return cleaned.replace(/^https?:\/\/[^@]+@/, 'https://')
  }

  return {
    branch: run('git rev-parse --abbrev-ref HEAD'),
    hash: run('git rev-parse --short HEAD'),
    hashFull: run('git rev-parse HEAD'),
    dirty: run('git status --porcelain').length > 0,
    remote: toWebUrl(run('git remote get-url origin')),
  }
})
