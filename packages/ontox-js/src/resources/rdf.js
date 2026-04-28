/* Create an RDF export resource. */
export function createRdfResource({ httpClient }) {
  return {
    /* Export Turtle RDF from current platform data. */
    async exportTurtle({ includeOntology, includeData, maxRowsPerEntity }) {
      return await httpClient.requestText({
        method: 'POST',
        path: '/api/rdf/export',
        body: { includeOntology, includeData, maxRowsPerEntity },
      })
    },
  }
}

