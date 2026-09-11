export default defineMonitoredTask({
  meta: {
    name: 'token-wallet-maintenance',
    description: 'Release abandoned reservations and expire promotional credit',
  },
  async run() {
    return { result: { released: await recoverTokenReservations() } }
  },
})
