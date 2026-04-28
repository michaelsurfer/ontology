import { getDatabase } from './database.js'

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
  const relationshipDefinition = normalizeRelationshipDefinitionInput(inputData)

  const result = database
    .prepare(
      `
      INSERT INTO relationship_definitions (
        relationship_name,
        subject_entity,
        subject_column,
        predicate_iri,
        object_entity,
        object_column
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      relationshipDefinition.relationship_name,
      relationshipDefinition.subject_entity,
      relationshipDefinition.subject_column,
      relationshipDefinition.predicate_iri,
      relationshipDefinition.object_entity,
      relationshipDefinition.object_column,
    )

  return database
    .prepare('SELECT * FROM relationship_definitions WHERE id = ?')
    .get(result.lastInsertRowid)
}

/* Update an existing relationship definition. */
export function updateRelationshipDefinition(id, inputData) {
  const database = getDatabase()
  const relationshipDefinition = normalizeRelationshipDefinitionInput(inputData)

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
        object_column = ?
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
      Number(id),
    )

  return database
    .prepare('SELECT * FROM relationship_definitions WHERE id = ?')
    .get(Number(id))
}

/* Delete a relationship definition by id. */
export function deleteRelationshipDefinition(id) {
  const database = getDatabase()
  database.prepare('DELETE FROM relationship_definitions WHERE id = ?').run(Number(id))
}

/* Delete all relationship definitions. */
export function deleteAllRelationshipDefinitions() {
  const database = getDatabase()
  const result = database.prepare('DELETE FROM relationship_definitions').run()
  return { deletedCount: result.changes }
}

/* Normalize and validate relationship definition fields. */
function normalizeRelationshipDefinitionInput(inputData) {
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const relationshipDefinition = {
    relationship_name: String(safeInputData.relationship_name || '').trim(),
    subject_entity: String(safeInputData.subject_entity || '').trim(),
    subject_column: String(safeInputData.subject_column || '').trim(),
    predicate_iri: String(safeInputData.predicate_iri || '').trim(),
    object_entity: String(safeInputData.object_entity || '').trim(),
    object_column: String(safeInputData.object_column || '').trim(),
  }

  const missingFields = Object.entries(relationshipDefinition)
    .filter(([, value]) => !value)
    .map(([fieldName]) => fieldName)

  if (missingFields.length > 0) {
    throw new Error(`Missing fields: ${missingFields.join(', ')}`)
  }

  return relationshipDefinition
}

