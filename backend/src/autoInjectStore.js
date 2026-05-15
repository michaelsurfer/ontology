import { getDatabase } from './database.js'
import { listCustomEntities } from './customEntities.js'
import { createCustomEntityRow } from './customEntityCrud.js'

/* Convert camelCase / mixed keys to snake_case for matching column names. */
function camelToSnakeIdentifier(value) {
  return String(value || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* Build row fields from payload using active column names (supports camelCase keys). */
function extractRowForEntity(payloadObj, activeFieldNames) {
  const safePayload = payloadObj && typeof payloadObj === 'object' && !Array.isArray(payloadObj) ? payloadObj : {}
  const lookup = {}
  for (const [rawKey, rawValue] of Object.entries(safePayload)) {
    const trimmed = String(rawKey || '').trim()
    if (!trimmed || trimmed === 'id' || trimmed === 'created_at') {
      continue
    }
    const lower = trimmed.toLowerCase()
    const snake = camelToSnakeIdentifier(trimmed)
    lookup[lower] = rawValue
    if (snake) {
      lookup[snake] = rawValue
    }
  }

  const row = {}
  for (const fieldName of activeFieldNames) {
    if (!fieldName) {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(safePayload, fieldName)) {
      row[fieldName] = safePayload[fieldName]
    } else if (lookup[fieldName] !== undefined) {
      row[fieldName] = lookup[fieldName]
    }
  }
  return row
}

/* Count how many active fields receive a value from the payload (match strength). */
function matchScoreForEntity(payloadObj, activeFieldNames) {
  const row = extractRowForEntity(payloadObj, activeFieldNames)
  return Object.keys(row).length
}

/* Coverage = matched fields / total active fields (for tie-breaking). */
function coverageRatio(score, activeFieldNames) {
  const total = activeFieldNames.length
  if (total === 0) {
    return 0
  }
  return score / total
}

/* Remove routing-only envelope keys so they do not affect entity matching. */
function stripEnvelopeKeys(obj) {
  const safe = obj && typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : {}
  delete safe.source
  delete safe.sourceId
  delete safe.meta
  return safe
}

/* Normalize HTTP body into an array of plain record objects. */
function normalizeBodyToRecords(body) {
  if (body === undefined || body === null) {
    return []
  }
  if (Array.isArray(body)) {
    return body
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => stripEnvelopeKeys(item))
  }
  if (typeof body !== 'object') {
    return []
  }

  if (Array.isArray(body.records)) {
    return body.records
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => stripEnvelopeKeys(item))
  }

  const nested =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data
      : body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? body.payload
        : body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes)
          ? body.attributes
          : null

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return [stripEnvelopeKeys(nested)]
  }

  const keys = Object.keys(body).filter((key) => !['records', 'source', 'meta'].includes(key))
  if (keys.length > 0 && keys.every((key) => typeof body[key] !== 'object' || body[key] === null)) {
    return [stripEnvelopeKeys(body)]
  }

  return []
}

/* Pick the single best-matching custom entity, or null if ambiguous / none. */
function resolveTargetEntity(entities, payloadObj) {
  const candidates = []

  for (const entity of entities) {
    const activeFieldNames = (entity.fields || [])
      .filter((field) => field && field.is_active)
      .map((field) => field.field_name)
      .filter(Boolean)

    if (activeFieldNames.length === 0) {
      continue
    }

    const score = matchScoreForEntity(payloadObj, activeFieldNames)
    const coverage = coverageRatio(score, activeFieldNames)

    candidates.push({
      entity_name: entity.entity_name,
      display_name: entity.display_name,
      activeFieldNames,
      score,
      coverage,
    })
  }

  candidates.sort((first, second) => {
    if (second.score !== first.score) {
      return second.score - first.score
    }
    if (second.coverage !== first.coverage) {
      return second.coverage - first.coverage
    }
    return String(first.entity_name).localeCompare(String(second.entity_name))
  })

  const best = candidates[0]
  const second = candidates[1]

  if (!best || best.score === 0) {
    return { winner: null, reason: 'no_entity_keys_match', candidates }
  }

  if (
    second &&
    second.score === best.score &&
    Math.abs(second.coverage - best.coverage) < 1e-12
  ) {
    return { winner: null, reason: 'ambiguous_multiple_entities', candidates }
  }

  return { winner: best, reason: null, candidates }
}

/* Persist an unmapped payload for later review. */
function insertLandingRecord({ payloadJson, reason, source }) {
  const database = getDatabase()
  const insert = database.prepare(`
    INSERT INTO auto_inject_unmapped (payload_json, reason, source)
    VALUES (?, ?, ?)
  `)
  const text = typeof payloadJson === 'string' ? payloadJson : JSON.stringify(payloadJson ?? null)
  const result = insert.run(text, String(reason || 'unknown'), String(source || 'auto_inject').trim() || 'auto_inject')
  return result.lastInsertRowid
}

/**
 * Auto-route JSON records to custom entity tables by overlapping column names (snake_case / camelCase).
 * Unmapped or ambiguous payloads go to auto_inject_unmapped.
 */
export function runAutoInject({ rawBody, source }) {
  const envelopeSource =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? rawBody.source ?? rawBody.sourceId
      : null
  const safeSource =
    source !== undefined && source !== null && String(source).trim()
      ? String(source).trim()
      : envelopeSource !== undefined && envelopeSource !== null
        ? String(envelopeSource).trim()
        : 'auto_inject'

  const records = normalizeBodyToRecords(rawBody)

  if (records.length === 0) {
    return {
      ok: true,
      accepted: 0,
      inserted: 0,
      landed: 0,
      results: [],
      message: 'No record objects found. Send a JSON object, an array of objects, or { records: [...] }.',
    }
  }

  const entities = listCustomEntities()
  const results = []
  let inserted = 0
  let landed = 0

  const transaction = getDatabase().transaction(() => {
    for (const record of records) {
      const resolution = resolveTargetEntity(entities, record)

      if (!resolution.winner) {
        const reason = resolution.reason || 'unknown'
        const landingId = insertLandingRecord({
          payloadJson: record,
          reason,
          source: safeSource || 'auto_inject',
        })
        landed += 1
        results.push({
          ok: false,
          reason,
          landing_id: landingId,
          candidates: (resolution.candidates || []).slice(0, 8).map((candidate) => ({
            entity_name: candidate.entity_name,
            score: candidate.score,
            coverage: candidate.coverage,
          })),
        })
        continue
      }

      const winner = resolution.winner
      const rowData = extractRowForEntity(record, winner.activeFieldNames)

      try {
        const createdRow = createCustomEntityRow(winner.entity_name, rowData)
        inserted += 1
        results.push({
          ok: true,
          entity_name: winner.entity_name,
          score: winner.score,
          coverage: winner.coverage,
          row: createdRow,
        })
      } catch (error) {
        const landingId = insertLandingRecord({
          payloadJson: record,
          reason: `insert_failed: ${error?.message ? String(error.message) : 'error'}`,
          source: safeSource || 'auto_inject',
        })
        landed += 1
        results.push({
          ok: false,
          reason: 'insert_failed',
          landing_id: landingId,
          entity_name: winner.entity_name,
          error: error?.message ? String(error.message) : 'insert_failed',
        })
      }
    }
  })

  transaction()

  return {
    ok: true,
    accepted: records.length,
    inserted,
    landed,
    results,
  }
}

/* Recent landing-zone rows (optional debugging). */
export function listAutoInjectUnmapped({ limit }) {
  const database = getDatabase()
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 500) : 100
  return database
    .prepare(
      `
      SELECT id, payload_json, reason, source, created_at
      FROM auto_inject_unmapped
      ORDER BY id DESC
      LIMIT ?
    `,
    )
    .all(safeLimit)
    .map((row) => ({
      ...row,
      payload: safeJsonParse(row.payload_json),
    }))
}

function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || 'null'))
  } catch (error) {
    return null
  }
}
