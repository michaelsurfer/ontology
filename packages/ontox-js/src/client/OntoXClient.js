import { createHttpClient } from './http.js'
import { createEntitiesResource } from '../resources/entities.js'
import { createCustomEntitiesResource } from '../resources/customEntities.js'
import { createSparqlResource } from '../resources/sparql.js'
import { createRdfResource } from '../resources/rdf.js'
import { createIngestResource } from '../resources/ingest.js'
import { createSuggestionsResource } from '../resources/suggestions.js'

/* OntoXClient is the main SDK entry point for calling the OntoX API. */
export class OntoXClient {
  constructor({ baseUrl, apiKey, timeoutMs } = {}) {
    const defaultHeaders = {}
    if (apiKey) {
      defaultHeaders['Authorization'] = `Bearer ${apiKey}`
    }

    this.httpClient = createHttpClient({ baseUrl, defaultHeaders, timeoutMs })

    this.entities = createEntitiesResource({ httpClient: this.httpClient })
    this.customEntities = createCustomEntitiesResource({ httpClient: this.httpClient })
    this.sparql = createSparqlResource({ httpClient: this.httpClient })
    this.rdf = createRdfResource({ httpClient: this.httpClient })
    this.ingest = createIngestResource({ httpClient: this.httpClient })
    this.suggestions = createSuggestionsResource({ httpClient: this.httpClient })
  }
}

