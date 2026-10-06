// Runs before route middleware, which reads the session synchronously.
export default defineNuxtPlugin({
  name: 'auth',
  async setup() {
    const { data, getSession } = useAuth()
    if (data.value === undefined) await getSession()
  },
})
