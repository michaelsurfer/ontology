/* Create an entities resource for listing all entities. */
export function createEntitiesResource({ httpClient }) {
  return {
    /* List builtin + custom entities with columns. */
    async list() {
      return await httpClient.requestJson({
        method: 'GET',
        path: '/api/entities',
      })
    },
  }
}

