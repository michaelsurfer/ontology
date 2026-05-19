import { getDataLayerBaseUrl, getRdfCacheBaseUrl } from './config.js';
import { dataLayerClient, type TurtleExportRequest } from './dataLayerClient.js';
import { requestJson } from './httpJson.js';

export type RdfCacheLoadResponse = {
  ok: boolean;
  version: number;
  turtle_bytes: number;
  updated_at_ms: number;
};

export type SparqlQueryResponse = {
  ok: boolean;
  version: number;
  variables: string[];
  rows: Array<Record<string, string | null>>;
  execution_time_ms: number;
};

// POST Turtle to rdf-cache-service /cache/load (replace in-memory graph).
export async function loadRdfCache(turtleText: string): Promise<RdfCacheLoadResponse> {
  const response = await fetch(`${getRdfCacheBaseUrl()}/cache/load`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      turtle: turtleText,
      replace: true,
    }),
  });

  const responseText = await response.text();
  let parsed: unknown = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }
  }

  if (!response.ok) {
    const errorMessage =
      parsed &&
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return parsed as RdfCacheLoadResponse;
}

// Export from data-layer and load into the RDF cache.
export async function syncRdfCacheFromDataLayer(exportOptions: TurtleExportRequest = { entity_ids: '*' }) {
  const turtleText = await dataLayerClient.exportTurtle(exportOptions);
  const loadResult = await loadRdfCache(turtleText);

  return {
    ok: true,
    dataLayerUrl: getDataLayerBaseUrl(),
    rdfCacheUrl: getRdfCacheBaseUrl(),
    version: loadResult.version,
    turtle_bytes: loadResult.turtle_bytes,
    updated_at_ms: loadResult.updated_at_ms,
  };
}

// Run SPARQL SELECT on the in-memory RDF cache.
export async function runSparqlQuery(queryText: string): Promise<SparqlQueryResponse> {
  return requestJson<SparqlQueryResponse>(getRdfCacheBaseUrl(), 'POST', '/sparql/query', {
    query: queryText,
  });
}

// Health check for rdf-cache-service.
export async function rdfCacheHealth(): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(getRdfCacheBaseUrl(), 'GET', '/health');
}
