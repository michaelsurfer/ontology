import { createOntoXApiError } from '../utils/errors.js'

/* Build a fetch-based HTTP client for OntoX API. */
export function createHttpClient({ baseUrl, defaultHeaders, timeoutMs }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) ? Number(timeoutMs) : 30000

  return {
    baseUrl: normalizedBaseUrl,

    /* Perform a JSON request and parse JSON response. */
    async requestJson({ method, path, query, body, headers }) {
      const response = await requestRaw({
        baseUrl: normalizedBaseUrl,
        timeoutMs: normalizedTimeoutMs,
        method,
        path,
        query,
        body,
        headers: { ...defaultHeaders, ...headers },
      })

      const text = await response.text()
      if (!text) {
        return null
      }

      try {
        return JSON.parse(text)
      } catch (error) {
        throw createOntoXApiError({
          message: `Expected JSON but received invalid JSON: ${text.slice(0, 200)}`,
          status: response.status,
        })
      }
    },

    /* Perform a JSON request and parse text response. */
    async requestText({ method, path, query, body, headers }) {
      const response = await requestRaw({
        baseUrl: normalizedBaseUrl,
        timeoutMs: normalizedTimeoutMs,
        method,
        path,
        query,
        body,
        headers: { ...defaultHeaders, ...headers },
      })

      return await response.text()
    },
  }
}

/* Perform an HTTP request and return a Response. */
async function requestRaw({ baseUrl, timeoutMs, method, path, query, body, headers }) {
  const url = new URL(joinUrl(baseUrl, path))

  const queryObject = query && typeof query === 'object' ? query : null
  if (queryObject) {
    for (const [key, value] of Object.entries(queryObject)) {
      if (value === undefined || value === null) {
        continue
      }
      url.searchParams.set(key, String(value))
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const requestHeaders = { ...(headers || {}) }
    let requestBody = undefined

    if (body !== undefined) {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json'
      requestBody = JSON.stringify(body)
    }

    const response = await fetch(url.toString(), {
      method: method || 'GET',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await safeReadText(response)
      throw createOntoXApiError({
        message: `HTTP ${response.status} ${response.statusText} for ${method} ${url.pathname}`,
        status: response.status,
        details: errorText,
      })
    }

    return response
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw createOntoXApiError({
        message: `Request timed out after ${timeoutMs}ms`,
        status: 408,
      })
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/* Normalize a base URL to not end with trailing slash. */
function normalizeBaseUrl(baseUrl) {
  const safeBaseUrl = String(baseUrl || '').trim() || 'http://localhost:5174'
  return safeBaseUrl.endsWith('/') ? safeBaseUrl.slice(0, -1) : safeBaseUrl
}

/* Join base URL and path without double slashes. */
function joinUrl(baseUrl, path) {
  const safePath = String(path || '')
  if (!safePath) {
    return baseUrl
  }
  if (safePath.startsWith('/')) {
    return `${baseUrl}${safePath}`
  }
  return `${baseUrl}/${safePath}`
}

/* Read response text safely for error details. */
async function safeReadText(response) {
  try {
    return await response.text()
  } catch (error) {
    return null
  }
}

