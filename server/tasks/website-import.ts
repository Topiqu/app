export default defineMonitoredTask({
  meta: { name: 'website-import', description: 'Prepare bounded website settings and knowledge drafts' },
  async run() {
    return { result: await drainWebsiteImports() }
  },
})
