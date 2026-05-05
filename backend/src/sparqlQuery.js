import { createRdfTurtleExport } from './rdfExport.js'

const defaultRdfCacheServiceUrl = 'http://127.0.0.1:8181'

/* Execute a SPARQL query against the current in-memory RDF graph. */
export async function executeSparqlQuery({ queryText, exportOptions }) {
  const normalizedQueryText = String(queryText || '').trim()
  if (!normalizedQueryText) {
    throw new Error('queryText is required')
  }

  return executeSparqlQueryViaRust({
    queryText: normalizedQueryText,
    exportOptions: exportOptions || {},
  })
}

/* Execute SPARQL using Rust cache service (Oxigraph) with automatic cache warm-up. */
async function executeSparqlQueryViaRust({ queryText, exportOptions }) {
  const response = await postRustSparqlQuery({ queryText })
  if (response.ok) {
    return response
  }

  const safeErrorText = String(response.error || '')
  const cacheLooksEmpty =
    safeErrorText.toLowerCase().includes('cache is empty') ||
    safeErrorText.toLowerCase().includes('invalid turtle in cache')

  if (!cacheLooksEmpty) {
    throw new Error(response.error || 'Rust SPARQL query failed')
  }

  const turtleText = await createRdfTurtleExport(exportOptions || {})
  const loadResult = await loadRustCacheFromTurtle({ turtleText, replace: true })
  if (!loadResult.ok) {
    throw new Error(loadResult.error || 'Failed to load RDF cache in Rust service')
  }

  const retryResponse = await postRustSparqlQuery({ queryText })
  if (!retryResponse.ok) {
    throw new Error(retryResponse.error || 'Rust SPARQL query failed after cache warm-up')
  }
  return retryResponse
}

/* Build Rust cache-service base URL from env with local default. */
function getRustCacheServiceUrl() {
  return String(process.env.RDF_CACHE_URL || defaultRdfCacheServiceUrl)
    .trim()
    .replace(/\/+$/, '')
}

/* POST a SPARQL query to Rust service and normalize the response. */
async function postRustSparqlQuery({ queryText }) {
  const endpoint = `${getRustCacheServiceUrl()}/sparql/query`
  let response = null
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: queryText }),
    })
  } catch (error) {
    return { ok: false, error: String(error?.message || error || 'Rust service unavailable') }
  }

  const payload = await safelyParseJson(response)
  if (!response.ok) {
    return { ok: false, error: String(payload?.error || `HTTP ${response.status}`) }
  }

  return {
    ok: true,
    variables: Array.isArray(payload?.variables) ? payload.variables : [],
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
  }
}

/* Load Turtle data into Rust cache service. */
async function loadRustCacheFromTurtle({ turtleText, replace }) {
  const endpoint = `${getRustCacheServiceUrl()}/cache/load`
  let response = null
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        turtle: String(turtleText || ''),
        replace: Boolean(replace),
      }),
    })
  } catch (error) {
    return { ok: false, error: String(error?.message || error || 'Rust service unavailable') }
  }

  const payload = await safelyParseJson(response)
  if (!response.ok) {
    return { ok: false, error: String(payload?.error || `HTTP ${response.status}`) }
  }
  return { ok: true }
}

/* Parse JSON safely without throwing to keep fallback behavior stable. */
async function safelyParseJson(response) {
  try {
    return await response.json()
  } catch (error) {
    return null
  }
}

