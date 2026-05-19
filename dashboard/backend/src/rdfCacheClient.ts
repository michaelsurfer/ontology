import { dataLayerClient } from './dataLayerClient.js';
import type { TurtleExportRequest } from './types.js';

const defaultRdfCacheUrl = 'http://127.0.0.1:8181';

export interface RdfCacheLoadResponse {
  ok: boolean;
  version: number;
  turtle_bytes: number;
  updated_at_ms: number;
}

export interface SyncRdfCacheResult {
  ok: boolean;
  dataLayerUrl: string;
  rdfCacheUrl: string;
  version: number;
  turtle_bytes: number;
  updated_at_ms: number;
}

// Resolve rdf-cache-service base URL from environment.
export function getRdfCacheBaseUrl(): string {
  return String(process.env.RDF_CACHE_URL || defaultRdfCacheUrl).replace(/\/+$/, '');
}

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

// Export full graph from data-layer, then load it into the Rust RDF cache.
export async function syncRdfCacheFromDataLayer(
  exportOptions: TurtleExportRequest = { entity_ids: '*' },
): Promise<SyncRdfCacheResult> {
  const turtleText = await dataLayerClient.exportTurtle(exportOptions);
  const loadResult = await loadRdfCache(turtleText);

  return {
    ok: true,
    dataLayerUrl: process.env.DATA_LAYER_URL || 'http://127.0.0.1:8182',
    rdfCacheUrl: getRdfCacheBaseUrl(),
    version: loadResult.version,
    turtle_bytes: loadResult.turtle_bytes,
    updated_at_ms: loadResult.updated_at_ms,
  };
}
