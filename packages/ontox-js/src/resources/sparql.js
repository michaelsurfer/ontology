/* Create a SPARQL resource for running queries. */
export function createSparqlResource({ httpClient }) {
  return {
    /* Run a SPARQL query and return JSON bindings. */
    async query({ queryText, includeOntology, includeData, maxRowsPerEntity }) {
      return await httpClient.requestJson({
        method: 'POST',
        path: '/api/sparql',
        body: {
          query: queryText,
          includeOntology,
          includeData,
          maxRowsPerEntity,
        },
      })
    },
  }
}

