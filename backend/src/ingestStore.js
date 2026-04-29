import { getDatabase } from './database.js'
import { getOntologySettings } from './mappingsStore.js'
import { createOpenAiClient } from './openaiClient.js'
import { getCustomEntityByName } from './customEntities.js'
import { createCustomEntityRow } from './customEntityCrud.js'
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
  const entityName = String(safePayload.entity_name || safePayload.entityName || '').trim()
  const aiModeValue = safePayload.ai_mode !== undefined ? safePayload.ai_mode : safePayload.aiMode
  const aiMode = normalizeBoolean(aiModeValue)

  const rawEvents = normalizePayloadToEvents({ safePayload, entityName, source })

  const normalizedEvents = rawEvents
    .map((event) => normalizeIncomingEvent({ source, event }))
    .filter(Boolean)

  if (normalizedEvents.length === 0) {
    return { accepted: 0, insertedEvents: 0, insertedSuggestions: 0, insertedRows: 0 }
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

  // If the caller explicitly provides entity_name, treat it as the target mapping for this payload.
  if (entityName) {
    const normalizedEntityTypeKey = normalizeEntityType(entityName)
    existingIngestMappings.set(normalizedEntityTypeKey, entityName)
    existingEntityNames.add(entityName)
  }

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

  const insertedRows = await upsertRowsFromIngestEvents({
    entityName,
    aiMode,
    openAiClient,
    normalizedEvents,
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
    insertedRows,
  }
}

/* Normalize a single incoming event into a safe internal shape. */
function normalizeIncomingEvent({ source, event }) {
  const safeEvent = event && typeof event === 'object' ? event : null
  if (!safeEvent) {
    return null
  }

  const entityType = String(
    safeEvent.entityType || safeEvent.entity_type || safeEvent.entity_name || safeEvent.entityName || '',
  ).trim()
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

/* Normalize a new-style ingestion payload into an array of event-like objects. */
function normalizePayloadToEvents({ safePayload, entityName, source }) {
  const safeEntityName = String(entityName || '').trim()

  if (Array.isArray(safePayload.events)) {
    // Backwards compatible "events" format, but enforce entityName if provided.
    return safePayload.events.map((event) => {
      if (!safeEntityName) {
        return event
      }
      const safeEvent = event && typeof event === 'object' ? event : {}
      return {
        ...safeEvent,
        entityType: safeEvent.entityType || safeEvent.entity_type || safeEntityName,
        entity_name: safeEntityName,
        ai_mode: safePayload.ai_mode !== undefined ? safePayload.ai_mode : safePayload.aiMode,
        source,
      }
    })
  }

  const rows = Array.isArray(safePayload.rows)
    ? safePayload.rows
    : safePayload.data && typeof safePayload.data === 'object'
      ? [safePayload.data]
      : safePayload.attributes && typeof safePayload.attributes === 'object'
        ? [safePayload.attributes]
        : []

  if (rows.length > 0) {
    return rows.map((row) => ({
      entityType: safeEntityName,
      operation: String(safePayload.operation || 'upsert'),
      externalId: safePayload.external_id || safePayload.externalId || null,
      occurredAt: safePayload.occurred_at || safePayload.occurredAt || new Date().toISOString(),
      attributes: row,
      links: Array.isArray(safePayload.links) ? safePayload.links : [],
      entity_name: safeEntityName,
      ai_mode: safePayload.ai_mode !== undefined ? safePayload.ai_mode : safePayload.aiMode,
      source,
    }))
  }

  // Fallback: treat payload itself as an event.
  return [safePayload]
}

/* Normalize an entity type string into a stable key. */
function normalizeEntityType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* Normalize a boolean-like input; returns null when missing/invalid. */
function normalizeBoolean(value) {
  if (value === true) return true
  if (value === false) return false
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (text === 'true') return true
  if (text === 'false') return false
  return null
}

/* Upsert rows into the requested custom entity table based on ingest events. */
async function upsertRowsFromIngestEvents({ entityName, aiMode, openAiClient, normalizedEvents }) {
  const safeEntityName = String(entityName || '').trim()
  if (!safeEntityName) {
    return 0
  }

  const entity = getCustomEntityByName(safeEntityName)
  if (!entity) {
    throw new Error(`Custom entity not found: ${safeEntityName}`)
  }

  const activeFieldNames = (entity.fields || [])
    .filter((field) => field && field.is_active)
    .map((field) => field.field_name)
    .filter(Boolean)

  const activeFieldNameSet = new Set(activeFieldNames)

  let insertedRows = 0
  for (const event of normalizedEvents) {
    const attributes = event?.attributes && typeof event.attributes === 'object' ? event.attributes : {}

    const fittedAttributes =
      aiMode === true
        ? await fitAttributesToEntityUsingAi({
            openAiClient,
            entityName: safeEntityName,
            targetFieldNames: activeFieldNames,
            attributes,
          })
        : attributes

    const rowData = mapAttributesToExistingColumns({
      attributes: fittedAttributes,
      activeFieldNameSet,
    })

    // If nothing matches, still insert an empty row to record presence.
    createCustomEntityRow(safeEntityName, rowData)
    insertedRows += 1
  }

  return insertedRows
}

/* Map an attributes object to existing active columns only. */
function mapAttributesToExistingColumns({ attributes, activeFieldNameSet }) {
  const safeAttributes = attributes && typeof attributes === 'object' ? attributes : {}
  const mapped = {}

  for (const [key, value] of Object.entries(safeAttributes)) {
    const columnName = String(key || '').trim()
    if (!columnName) {
      continue
    }
    if (columnName === 'id' || columnName === 'created_at') {
      continue
    }
    if (!activeFieldNameSet.has(columnName)) {
      continue
    }
    mapped[columnName] = value
  }

  return mapped
}

/* Use AI to fit and correct incoming data to a specific entity table schema. */
async function fitAttributesToEntityUsingAi({ openAiClient, entityName, targetFieldNames, attributes }) {
  if (!openAiClient) {
    return attributes
  }

  const safeTargetFieldNames = Array.isArray(targetFieldNames) ? targetFieldNames : []
  const safeAttributes = attributes && typeof attributes === 'object' ? attributes : {}

  if (safeTargetFieldNames.length === 0) {
    return safeAttributes
  }

  const model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'

  const messages = [
    {
      role: 'system',
      content:
        'You are a data cleaning assistant. Map incoming JSON attributes to the target table columns. ' +
        'Return JSON only with keys: mapped (object), notes (string). ' +
        'Rules: Only use keys that exist in targetFieldNames. If a field name is close (typo/synonym), correct it. ' +
        'Do not invent new columns.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          entity_name: entityName,
          targetFieldNames: safeTargetFieldNames,
          attributes: safeAttributes,
          output: { mapped: { column: 'value' }, notes: 'string' },
        },
        null,
        2,
      ),
    },
  ]

  const responseJson = await tryChatJson({ openAiClient, model, messages })
  const mapped = responseJson?.mapped && typeof responseJson.mapped === 'object' ? responseJson.mapped : null
  if (!mapped) {
    return safeAttributes
  }

  return mapped
}

/* Attempt to get structured JSON back from chat completions. */
async function tryChatJson({ openAiClient, model, messages }) {
  let result = null
  try {
    result = await openAiClient.chat.completions.create({
      model,
      temperature: 0.1,
      messages,
      response_format: { type: 'json_object' },
    })
  } catch (error) {
    try {
      result = await openAiClient.chat.completions.create({
        model,
        temperature: 0.1,
        messages,
      })
    } catch (secondError) {
      return null
    }
  }

  const content = result?.choices?.[0]?.message?.content
  if (!content) {
    return null
  }

  try {
    return JSON.parse(content)
  } catch (error) {
    return null
  }
}

/* Parse JSON safely for debugging views. */
function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || 'null'))
  } catch (error) {
    return null
  }
}

