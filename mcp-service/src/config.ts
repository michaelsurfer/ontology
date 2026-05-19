const defaultDataLayerUrl = 'http://127.0.0.1:8182';
const defaultRdfCacheUrl = 'http://127.0.0.1:8181';

// Resolve data-layer-service base URL from environment.
export function getDataLayerBaseUrl(): string {
  return String(process.env.DATA_LAYER_URL || defaultDataLayerUrl).replace(/\/+$/, '');
}

// Resolve rdf-cache-service base URL from environment.
export function getRdfCacheBaseUrl(): string {
  return String(process.env.RDF_CACHE_URL || defaultRdfCacheUrl).replace(/\/+$/, '');
}
