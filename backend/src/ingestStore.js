import { getDatabase } from './database.js'
import { getOntologySettings } from './mappingsStore.js'
import { createOpenAiClient } from './openaiClient.js'
import { generateDraftSuggestionsFromEvents } from './ontologyAutoSuggest.js'

/* List recent ingest events for debugging and audit. */
export function listIngestEvents({ limit }) {
  const database = getDatabase()
  const safeLimit = Number.isFinite(limit) ? Number(limit) : 100

  return database
    .prepare(
      `
      SELECT id, source, entity_type, operation, external_id, occurred_at, created_at, payload_json
      FROM ingest_events
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

/* Create ingest events and generate draft ontology suggestions. */
export async function createIngestEvents({ payload }) {
  const database = getDatabase()
  const safePayload = payload && typeof payload === 'object' ? payload : {}

  const source = String(safePayload.source || 'custom').trim() || 'custom'
  const rawEvents = Array.isArray(safePayload.events) ? safePayload.events : [safePayload]

  const normalizedEvents = rawEvents
    .map((event) => normalizeIncomingEvent({ source, event }))
    .filter(Boolean)

  if (normalizedEvents.length === 0) {
    return { accepted: 0, insertedEvents: 0, insertedSuggestions: 0 }
  }

  const ontologySettings = getOntologySettings()
  const baseIri = String(ontologySettings?.base_iri || '').trim() || 'http://example.com/ontology#'

  const existingEntityNames = new Set(
    database.prepare('SELECT entity_name FROM entity_mappings').all().map((row) => row.entity_name),
  )

  const existingIngestMappings = new Map(
    database
      .prepare('SELECT entity_type, target_entity_name FROM ingest_entity_type_mappings')
      .all()
      .map((row) => [row.entity_type, row.target_entity_name]),
  )

  const customEntityFieldNamesByEntityName = new Map()
  const customEntityFieldRows = database
    .prepare(
      `
      SELECT ce.entity_name AS entity_name, cef.field_name AS field_name
      FROM custom_entities ce
      JOIN custom_entity_fields cef ON cef.custom_entity_id = ce.id
      ORDER BY ce.entity_name ASC, cef.field_name ASC
    `,
    )
    .all()

  for (const row of customEntityFieldRows) {
    const list = customEntityFieldNamesByEntityName.get(row.entity_name) || []
    list.push(row.field_name)
    customEntityFieldNamesByEntityName.set(row.entity_name, list)
  }

  const openAiClient = createOpenAiClient()

  const draftSuggestions = await generateDraftSuggestionsFromEvents({
    events: normalizedEvents,
    baseIri,
    existingEntityNames,
    existingIngestMappings,
    customEntityFieldNamesByEntityName,
    openAiClient,
  })

  const transaction = database.transaction(() => {
    const insertEvent = database.prepare(`
      INSERT INTO ingest_events (source, entity_type, operation, external_id, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const insertSuggestion = database.prepare(`
      INSERT OR IGNORE INTO ontology_suggestions (
        suggestion_type,
        status,
        title,
        confidence,
        fingerprint,
        proposal_json,
        evidence_json,
        ai_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let insertedEvents = 0
    for (const event of normalizedEvents) {
      insertEvent.run(
        event.source,
        event.entity_type,
        event.operation,
        event.external_id,
        event.occurred_at,
        JSON.stringify(event.raw_payload),
      )
      insertedEvents += 1
    }

    let insertedSuggestions = 0
    for (const suggestion of draftSuggestions) {
      const result = insertSuggestion.run(
        suggestion.suggestion_type,
        suggestion.status,
        suggestion.title,
        suggestion.confidence,
        suggestion.fingerprint,
        suggestion.proposal_json,
        suggestion.evidence_json,
        suggestion.ai_summary,
      )
      if (result.changes > 0) {
        insertedSuggestions += 1
      }
    }

    return { insertedEvents, insertedSuggestions }
  })

  const result = transaction()

  return {
    accepted: normalizedEvents.length,
    insertedEvents: result.insertedEvents,
    insertedSuggestions: result.insertedSuggestions,
  }
}

/* Normalize a single incoming event into a safe internal shape. */
function normalizeIncomingEvent({ source, event }) {
  const safeEvent = event && typeof event === 'object' ? event : null
  if (!safeEvent) {
    return null
  }

  const entityType = String(safeEvent.entityType || safeEvent.entity_type || '').trim()
  const operation = String(safeEvent.operation || 'upsert').trim() || 'upsert'

  if (!entityType) {
    return null
  }

  const externalId = safeEvent.externalId || safeEvent.external_id ? String(safeEvent.externalId || safeEvent.external_id) : null

  const occurredAt = safeEvent.occurredAt || safeEvent.occurred_at ? String(safeEvent.occurredAt || safeEvent.occurred_at) : null

  const attributes =
    safeEvent.attributes && typeof safeEvent.attributes === 'object' ? safeEvent.attributes : {}

  const links = Array.isArray(safeEvent.links) ? safeEvent.links : []

  return {
    source,
    entity_type: normalizeEntityType(entityType),
    operation,
    external_id: externalId,
    occurred_at: occurredAt,
    attributes,
    links,
    raw_payload: safeEvent,
  }
}

/* Normalize an entity type string into a stable key. */
function normalizeEntityType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* Parse JSON safely for debugging views. */
function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || 'null'))
  } catch (error) {
    return null
  }
}

