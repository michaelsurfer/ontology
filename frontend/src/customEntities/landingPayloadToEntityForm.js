import { createEmptyEntityForm, createEmptyField } from './customEntityFormShared.js'

/* Match backend auto-inject key normalization for suggested column names. */
function camelToSnakeIdentifier(value) {
  return String(value || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* Infer SQLite-oriented field type from a payload value. */
function inferFieldType(value) {
  if (value === null || value === undefined) {
    return 'TEXT'
  }
  if (typeof value === 'boolean') {
    return 'TEXT'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? 'INTEGER' : 'REAL'
  }
  return 'TEXT'
}

const SKIP_KEYS = new Set([
  'id',
  'created_at',
  'source',
  'source_id',
  'sourceid',
  'meta',
  'records',
  'data',
  'payload',
  'attributes',
])

/* Whether we should add a column for this JSON value (flat payloads only). */
function shouldIncludeValue(value) {
  if (value === null || value === undefined) {
    return true
  }
  const valueType = typeof value
  if (valueType === 'object') {
    return false
  }
  return true
}

/* Build create-entity form JSON suitable for POST /api/custom-entities from a landing-zone payload. */
export function buildInitialEntityFormFromLandingPayload(payload, landingRowId) {
  const safeRowId = Number.isFinite(Number(landingRowId)) ? Number(landingRowId) : Date.now()
  const baseEntityName = `from_landing_${safeRowId}`
  const safePayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}

  const fields = []
  const usedNames = new Set()

  for (const [rawKey, rawValue] of Object.entries(safePayload)) {
    const trimmed = String(rawKey || '').trim()
    if (!trimmed) {
      continue
    }
    const lower = trimmed.toLowerCase()
    if (SKIP_KEYS.has(lower)) {
      continue
    }
    if (!shouldIncludeValue(rawValue)) {
      continue
    }

    let fieldName = camelToSnakeIdentifier(trimmed)
    if (!fieldName) {
      continue
    }
    if (!/^[a-z]/.test(fieldName)) {
      fieldName = `col_${fieldName}`
    }
    if (!/^[a-z][a-z0-9_]*$/.test(fieldName)) {
      fieldName = `col_${safeRowId}`
    }

    let uniqueName = fieldName
    let suffix = 2
    while (usedNames.has(uniqueName)) {
      uniqueName = `${fieldName}_${suffix}`
      suffix += 1
    }
    usedNames.add(uniqueName)

    fields.push({
      field_name: uniqueName,
      field_type: inferFieldType(rawValue),
      is_required: false,
    })
  }

  if (fields.length === 0) {
    return {
      ...createEmptyEntityForm(),
      entity_name: baseEntityName,
      display_name: `From landing ${safeRowId}`,
      fields: [createEmptyField()],
    }
  }

  const displayName = baseEntityName.replace(/_/g, ' ')
  return {
    entity_name: baseEntityName,
    display_name: displayName,
    fields,
  }
}
