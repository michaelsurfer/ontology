/* Auto-inject resource: schema-free JSON routed to custom entities by column overlap. */
export function createAutoInjectResource({ httpClient }) {
  return {
    async inject(payload) {
      return await httpClient.requestJson({
        method: 'POST',
        path: '/api/auto-inject',
        body: payload,
      })
    },

    async listUnmapped({ limit } = {}) {
      return await httpClient.requestJson({
        method: 'GET',
        path: '/api/auto-inject/unmapped',
        query: limit !== undefined ? { limit } : undefined,
      })
    },
  }
}
