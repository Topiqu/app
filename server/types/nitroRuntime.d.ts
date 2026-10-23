declare module '#nitro-internal-virtual/tasks' {
  export const scheduledTasks: { cron: string; tasks: string[] }[] | false | undefined
}

interface ImportMeta {
  readonly _tasks: boolean
  readonly _websocket: boolean
}
