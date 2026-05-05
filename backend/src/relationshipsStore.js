import { getDatabase } from './database.js'
import {
  createAutomatedLinkTableEntity,
  deleteAutomatedLinkTableOnly,
} from './customEntities.js'

/* Fetch all relationship definitions used for RDF object properties. */
export function getRelationshipDefinitions() {
  const database = getDatabase()
  return database
    .prepare('SELECT * FROM relationship_definitions ORDER BY id DESC')
    .all()
}

/* Create a new relationship definition. */
export function createRelationshipDefinition(inputData) {
  const database = getDatabase()
  const safeInput = inputData && typeof inputData === 'object' ? inputData : {}
  const core = extractCoreRelationshipFieldsFromInput(safeInput)
  validateCoreRelationshipFieldsPresent(core)

  const baseIri = String(safeInput.base_iri || '').trim() || 'http://example.com/context#'
  const linkMeta = createAutomatedLinkTableEntity({
    subject_entity: core.subject_entity,
    object_entity: core.object_entity,
    relationship_name: core.relationship_name,
    base_iri: baseIri,
  })
  const enrichedInput = {
    ...safeInput,
    ...core,
    junction_entity: linkMeta.entity_name,
    junction_subject_column: linkMeta.junction_subject_column,
    junction_object_column: linkMeta.junction_object_column,
  }

  const relationshipDefinition = normalizeRelationshipDefinitionInput(enrichedInput)

  const result = database
    .prepare(
      `
      INSERT INTO relationship_definitions (
        relationship_name,
        subject_entity,
        subject_column,
        predicate_iri,
        object_entity,
        object_column,
        junction_entity,
        junction_subject_column,
        junction_object_column,
        junction_auto_created
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      relationshipDefinition.relationship_name,
      relationshipDefinition.subject_entity,
      relationshipDefinition.subject_column,
      relationshipDefinition.predicate_iri,
      relationshipDefinition.object_entity,
      relationshipDefinition.object_column,
      relationshipDefinition.junction_entity,
      relationshipDefinition.junction_subject_column,
      relationshipDefinition.junction_object_column,
      1,
    )

  return database
    .prepare('SELECT * FROM relationship_definitions WHERE id = ?')
    .get(result.lastInsertRowid)
}

/* Update an existing relationship definition. */
export function updateRelationshipDefinition(id, inputData) {
  const database = getDatabase()
  const oldRow = database.prepare('SELECT * FROM relationship_definitions WHERE id = ?').get(Number(id))
  if (!oldRow) {
    throw new Error('Relationship not found')
  }

  const safeInput = inputData && typeof inputData === 'object' ? inputData : {}
  const core = extractCoreRelationshipFieldsFromInput(safeInput)
  validateCoreRelationshipFieldsPresent(core)

  const baseIri = String(safeInput.base_iri || '').trim() || 'http://example.com/context#'

  const oldHadCompleteJunction =
    Boolean(String(oldRow.junction_entity || '').trim()) &&
    Boolean(String(oldRow.junction_subject_column || '').trim()) &&
    Boolean(String(oldRow.junction_object_column || '').trim())

  const oldWasAutoLink = Number(oldRow.junction_auto_created || 0) === 1
  const oldJun = String(oldRow.junction_entity || '').trim()

  const linkShapeUnchanged =
    oldRow.subject_entity === core.subject_entity &&
    oldRow.subject_column === core.subject_column &&
    oldRow.object_entity === core.object_entity &&
    oldRow.object_column === core.object_column

  const shouldRebuildLinkTable = !oldHadCompleteJunction || !linkShapeUnchanged

  if (shouldRebuildLinkTable && oldHadCompleteJunction && !oldWasAutoLink) {
    throw new Error(
      'This relationship uses a custom link table. Delete it and create a new relationship to change the joined entities or columns.',
    )
  }

  let junction_entity = null
  let junction_subject_column = null
  let junction_object_column = null
  let nextJunctionAutoCreated = 0

  if (!shouldRebuildLinkTable) {
    junction_entity = String(oldRow.junction_entity || '').trim()
    junction_subject_column = String(oldRow.junction_subject_column || '').trim()
    junction_object_column = String(oldRow.junction_object_column || '').trim()
    nextJunctionAutoCreated = Number(oldRow.junction_auto_created || 0)
  }

  if (shouldRebuildLinkTable) {
    if (oldWasAutoLink && oldJun) {
      deleteAutomatedLinkTableOnly({ entity_name: oldJun })
    }

    const linkMeta = createAutomatedLinkTableEntity({
      subject_entity: core.subject_entity,
      object_entity: core.object_entity,
      relationship_name: core.relationship_name,
      base_iri: baseIri,
    })
    junction_entity = linkMeta.entity_name
    junction_subject_column = linkMeta.junction_subject_column
    junction_object_column = linkMeta.junction_object_column
    nextJunctionAutoCreated = 1
  }

  const relationshipDefinition = normalizeRelationshipDefinitionInput({
    ...core,
    junction_entity,
    junction_subject_column,
    junction_object_column,
  })

  database
    .prepare(
      `
      UPDATE relationship_definitions
      SET
        relationship_name = ?,
        subject_entity = ?,
        subject_column = ?,
        predicate_iri = ?,
        object_entity = ?,
        object_column = ?,
        junction_entity = ?,
        junction_subject_column = ?,
        junction_object_column = ?,
        junction_auto_created = ?
      WHERE id = ?
    `,
    )
    .run(
      relationshipDefinition.relationship_name,
      relationshipDefinition.subject_entity,
      relationshipDefinition.subject_column,
      relationshipDefinition.predicate_iri,
      relationshipDefinition.object_entity,
      relationshipDefinition.object_column,
      relationshipDefinition.junction_entity,
      relationshipDefinition.junction_subject_column,
      relationshipDefinition.junction_object_column,
      nextJunctionAutoCreated,
      Number(id),
    )

  return database
    .prepare('SELECT * FROM relationship_definitions WHERE id = ?')
    .get(Number(id))
}

/* Delete a relationship definition by id. */
export function deleteRelationshipDefinition(id) {
  const database = getDatabase()
  const row = database.prepare('SELECT * FROM relationship_definitions WHERE id = ?').get(Number(id))
  database.prepare('DELETE FROM relationship_definitions WHERE id = ?').run(Number(id))
  if (row && Number(row.junction_auto_created || 0) === 1 && String(row.junction_entity || '').trim()) {
    try {
      deleteAutomatedLinkTableOnly({ entity_name: row.junction_entity })
    } catch (error) {
      /* Link table may already be missing; relationship row is already removed. */
    }
  }
}

/* Delete all relationship definitions. */
export function deleteAllRelationshipDefinitions() {
  const database = getDatabase()
  const autoRows = database
    .prepare(
      `SELECT DISTINCT junction_entity FROM relationship_definitions
       WHERE COALESCE(junction_auto_created, 0) = 1
       AND junction_entity IS NOT NULL AND TRIM(junction_entity) != ''`,
    )
    .all()

  for (const row of autoRows) {
    try {
      deleteAutomatedLinkTableOnly({ entity_name: row.junction_entity })
    } catch (error) {
      /* Continue clearing relationships even if a link table drop fails. */
    }
  }

  const result = database.prepare('DELETE FROM relationship_definitions').run()
  return { deletedCount: result.changes }
}

/* Normalize and validate relationship definition fields. */
function normalizeRelationshipDefinitionInput(inputData) {
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const junctionEntity = normalizeOptionalText(safeInputData.junction_entity)
  const junctionSubjectColumn = normalizeOptionalText(safeInputData.junction_subject_column)
  const junctionObjectColumn = normalizeOptionalText(safeInputData.junction_object_column)

  const relationshipDefinition = {
    relationship_name: String(safeInputData.relationship_name || '').trim(),
    subject_entity: String(safeInputData.subject_entity || '').trim(),
    subject_column: String(safeInputData.subject_column || '').trim(),
    predicate_iri: String(safeInputData.predicate_iri || '').trim(),
    object_entity: String(safeInputData.object_entity || '').trim(),
    object_column: String(safeInputData.object_column || '').trim(),
    junction_entity: junctionEntity || null,
    junction_subject_column: junctionSubjectColumn || null,
    junction_object_column: junctionObjectColumn || null,
  }

  const missingFields = Object.entries({
    relationship_name: relationshipDefinition.relationship_name,
    subject_entity: relationshipDefinition.subject_entity,
    subject_column: relationshipDefinition.subject_column,
    predicate_iri: relationshipDefinition.predicate_iri,
    object_entity: relationshipDefinition.object_entity,
    object_column: relationshipDefinition.object_column,
  })
    .filter(([, value]) => !value)
    .map(([fieldName]) => fieldName)

  if (missingFields.length > 0) {
    throw new Error(`Missing fields: ${missingFields.join(', ')}`)
  }

  const hasAnyJunctionField =
    relationshipDefinition.junction_entity ||
    relationshipDefinition.junction_subject_column ||
    relationshipDefinition.junction_object_column

  if (hasAnyJunctionField) {
    if (
      !relationshipDefinition.junction_entity ||
      !relationshipDefinition.junction_subject_column ||
      !relationshipDefinition.junction_object_column
    ) {
      throw new Error(
        'Link table fields are incomplete (junction_entity, junction_subject_column, junction_object_column)',
      )
    }
    if (relationshipDefinition.junction_entity === relationshipDefinition.subject_entity) {
      throw new Error('junction_entity must differ from subject_entity')
    }
    if (relationshipDefinition.junction_entity === relationshipDefinition.object_entity) {
      throw new Error('junction_entity must differ from object_entity')
    }
  }

  return relationshipDefinition
}

/* Trim optional string fields; treat blank as empty. */
function normalizeOptionalText(value) {
  return String(value ?? '').trim()
}

/* Core relationship fields accepted from API clients (link table is always system-managed). */
function extractCoreRelationshipFieldsFromInput(inputData) {
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}
  return {
    relationship_name: String(safeInputData.relationship_name || '').trim(),
    subject_entity: String(safeInputData.subject_entity || '').trim(),
    subject_column: String(safeInputData.subject_column || '').trim(),
    predicate_iri: String(safeInputData.predicate_iri || '').trim(),
    object_entity: String(safeInputData.object_entity || '').trim(),
    object_column: String(safeInputData.object_column || '').trim(),
  }
}

/* Ensure core relationship fields are present before persisting. */
function validateCoreRelationshipFieldsPresent(core) {
  const missingFields = Object.entries(core)
    .filter(([, value]) => !value)
    .map(([fieldName]) => fieldName)

  if (missingFields.length > 0) {
    throw new Error(`Missing fields: ${missingFields.join(', ')}`)
  }
}
