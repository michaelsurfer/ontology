import { getDatabase } from './database.js'
import { getOntologySettings } from './mappingsStore.js'
import { createCustomEntity, addCustomEntityField } from './customEntities.js'
import { createRelationshipDefinition } from './relationshipsStore.js'
import { createOntologyRule } from './rulesStore.js'

/* List ontology suggestions with optional status filtering. */
export function listSuggestions({ status }) {
  const database = getDatabase()
  const normalizedStatus = status ? String(status).trim() : null

  const rows = normalizedStatus
    ? database
        .prepare(
          `
          SELECT *
          FROM ontology_suggestions
          WHERE status = ?
          ORDER BY id DESC
        `,
        )
        .all(normalizedStatus)
    : database
        .prepare(
          `
          SELECT *
          FROM ontology_suggestions
          ORDER BY id DESC
        `,
        )
        .all()

  return rows.map((row) => ({
    ...row,
    proposal: safeJsonParse(row.proposal_json),
    evidence: safeJsonParse(row.evidence_json),
  }))
}

/* Mark a suggestion as approved. */
export function approveSuggestion({ id }) {
  const database = getDatabase()
  const suggestionId = Number(id)
  if (!Number.isFinite(suggestionId)) {
    throw new Error('Invalid suggestion id')
  }

  database
    .prepare("UPDATE ontology_suggestions SET status = 'approved' WHERE id = ?")
    .run(suggestionId)

  return getSuggestionById({ id: suggestionId })
}

/* Mark a suggestion as rejected. */
export function rejectSuggestion({ id }) {
  const database = getDatabase()
  const suggestionId = Number(id)
  if (!Number.isFinite(suggestionId)) {
    throw new Error('Invalid suggestion id')
  }

  database
    .prepare("UPDATE ontology_suggestions SET status = 'rejected' WHERE id = ?")
    .run(suggestionId)

  return getSuggestionById({ id: suggestionId })
}

/* Delete a single suggestion by id. */
export function deleteSuggestion({ id }) {
  const database = getDatabase()
  const suggestionId = Number(id)
  if (!Number.isFinite(suggestionId)) {
    throw new Error('Invalid suggestion id')
  }

  const row = database.prepare('SELECT id, status FROM ontology_suggestions WHERE id = ?').get(suggestionId)
  if (!row) {
    return { deleted: false, reason: 'Not found' }
  }

  // Prevent deleting published suggestions (history/audit).
  if (String(row.status) === 'published') {
    return { deleted: false, reason: 'Cannot delete published suggestions' }
  }

  const result = database.prepare('DELETE FROM ontology_suggestions WHERE id = ?').run(suggestionId)
  return { deleted: result.changes > 0, id: suggestionId }
}

/* Delete suggestions by status (bulk). */
export function deleteSuggestionsByStatus({ status }) {
  const database = getDatabase()
  const normalizedStatus = String(status || '').trim()
  if (!normalizedStatus) {
    throw new Error('status is required')
  }

  if (normalizedStatus === 'published') {
    throw new Error('Refusing to bulk delete published suggestions')
  }

  const result = database
    .prepare('DELETE FROM ontology_suggestions WHERE status = ?')
    .run(normalizedStatus)

  return { deletedCount: result.changes, status: normalizedStatus }
}

/* Publish all approved suggestions by applying them to the live ontology/tables. */
export function publishApprovedSuggestions() {
  const database = getDatabase()
  const settings = getOntologySettings()
  const baseIri = String(settings?.base_iri || '').trim() || 'http://example.com/context#'

  const approvedSuggestions = database
    .prepare("SELECT * FROM ontology_suggestions WHERE status = 'approved' ORDER BY id ASC")
    .all()

  const results = []

  for (const row of approvedSuggestions) {
    const proposal = safeJsonParse(row.proposal_json) || {}

    try {
      const appliedResult = applySuggestion({
        suggestionType: row.suggestion_type,
        proposal,
        baseIri,
      })

      database
        .prepare("UPDATE ontology_suggestions SET status = 'published' WHERE id = ?")
        .run(row.id)

      results.push({
        id: row.id,
        status: 'published',
        suggestion_type: row.suggestion_type,
        title: row.title,
        applied: true,
        result: appliedResult,
      })
    } catch (error) {
      results.push({
        id: row.id,
        status: 'approved',
        suggestion_type: row.suggestion_type,
        title: row.title,
        applied: false,
        error: error?.message || String(error),
      })
    }
  }

  return {
    publishedCount: results.filter((item) => item.applied).length,
    failedCount: results.filter((item) => !item.applied).length,
    results,
  }
}

/* Fetch a suggestion by id. */
function getSuggestionById({ id }) {
  const database = getDatabase()
  const row = database.prepare('SELECT * FROM ontology_suggestions WHERE id = ?').get(Number(id))
  if (!row) {
    return null
  }
  return {
    ...row,
    proposal: safeJsonParse(row.proposal_json),
    evidence: safeJsonParse(row.evidence_json),
  }
}

/* Apply a single suggestion based on its type. */
function applySuggestion({ suggestionType, proposal, baseIri }) {
  if (suggestionType === 'ingest_mapping') {
    return applyIngestMappingSuggestion({ proposal })
  }

  if (suggestionType === 'entity_create') {
    return applyEntityCreateSuggestion({ proposal, baseIri })
  }

  if (suggestionType === 'field_add') {
    return applyFieldAddSuggestion({ proposal, baseIri })
  }

  if (suggestionType === 'relationship_create') {
    return createRelationshipDefinition(proposal)
  }

  if (suggestionType === 'rule_create') {
    return createOntologyRule(proposal)
  }

  throw new Error(`Unsupported suggestion type: ${suggestionType}`)
}

/* Apply an ingest mapping (entity_type -> target_entity_name). */
function applyIngestMappingSuggestion({ proposal }) {
  const database = getDatabase()
  const entityType = String(proposal.entity_type || '').trim()
  const targetEntityName = String(proposal.target_entity_name || '').trim()

  if (!entityType || !targetEntityName) {
    throw new Error('Missing entity_type or target_entity_name')
  }

  database
    .prepare(
      `
      INSERT INTO ingest_entity_type_mappings (entity_type, target_entity_name)
      VALUES (?, ?)
      ON CONFLICT(entity_type) DO UPDATE SET
        target_entity_name = excluded.target_entity_name
    `,
    )
    .run(entityType, targetEntityName)

  return { entity_type: entityType, target_entity_name: targetEntityName }
}

/* Apply an entity creation suggestion by creating a custom entity table. */
function applyEntityCreateSuggestion({ proposal, baseIri }) {
  const entityName = proposal.entity_name
  const displayName = proposal.display_name
  const fields = proposal.fields

  return createCustomEntity({
    entity_name: entityName,
    display_name: displayName,
    fields,
    base_iri: proposal.base_iri || baseIri,
  })
}

/* Apply a field add suggestion by altering a custom entity table. */
function applyFieldAddSuggestion({ proposal, baseIri }) {
  return addCustomEntityField({
    entity_name: proposal.entity_name,
    field_name: proposal.field_name,
    field_type: proposal.field_type,
    is_required: proposal.is_required,
    base_iri: proposal.base_iri || baseIri,
  })
}

/* Parse JSON safely. */
function safeJsonParse(value) {
  if (value === null || value === undefined) {
    return null
  }
  try {
    return JSON.parse(String(value))
  } catch (error) {
    return null
  }
}

