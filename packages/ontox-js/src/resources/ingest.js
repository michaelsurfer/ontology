/* Create an ingestion resource for sending events. */
export function createIngestResource({ httpClient }) {
  return {
    /* Send ingest events (webhook/SDK front door). */
    async events(payload) {
      return await httpClient.requestJson({
        method: 'POST',
        path: '/api/ingest/events',
        body: payload,
      })
    },

    /* List recent ingest events (debug/audit). */
    async listEvents({ limit } = {}) {
      return await httpClient.requestJson({
        method: 'GET',
        path: '/api/ingest/events',
        query: { limit },
      })
    },
  }
}

