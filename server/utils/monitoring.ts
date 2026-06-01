type HeartbeatStatus = 'success' | 'fail'

function heartbeatUrl(taskName: string): string | undefined {
  const key = `BETTERSTACK_HEARTBEAT_${taskName.toUpperCase().replace(/-/g, '_')}`
  return process.env[key]
}

export async function pingHeartbeat(taskName: string, status: HeartbeatStatus = 'success'): Promise<void> {
  const url = heartbeatUrl(taskName)
  if (!url) return

  try {
    await $fetch(status === 'fail' ? `${url}/fail` : url, {
      method: 'GET',
      timeout: 5000,
      retry: 1,
    })
  } catch {
    return
  }
}

export async function withHeartbeat<T>(taskName: string, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run()
    await pingHeartbeat(taskName, 'success')
    return result
  } catch (error) {
    await pingHeartbeat(taskName, 'fail')
    throw error
  }
}
