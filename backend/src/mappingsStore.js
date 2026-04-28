import { getDatabase } from './database.js'

/* Fetch the global ontology settings (base IRI, etc). */
export function getOntologySettings() {
  const database = getDatabase()
  return database.prepare('SELECT id, base_iri FROM ontology_settings WHERE id = 1').get()
}

/* Update the global ontology settings. */
export function updateOntologySettings(inputData) {
  const database = getDatabase()
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const nextBaseIri = String(safeInputData.base_iri || '').trim()
  if (!nextBaseIri) {
    throw new Error('base_iri is required')
  }

  database.prepare('UPDATE ontology_settings SET base_iri = ? WHERE id = 1').run(nextBaseIri)
  return getOntologySettings()
}

/* List entity-to-class mappings (tables to OWL classes). */
export function getEntityMappings() {
  const database = getDatabase()
  return database.prepare('SELECT * FROM entity_mappings ORDER BY entity_name ASC').all()
}

/* Insert or update a single entity mapping. */
export function upsertEntityMapping(entityName, inputData) {
  const database = getDatabase()
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const normalizedEntityName = String(entityName || '').trim()
  const classIri = String(safeInputData.class_iri || '').trim()
  const subjectIriTemplate = String(safeInputData.subject_iri_template || '').trim()

  if (!normalizedEntityName || !classIri || !subjectIriTemplate) {
    throw new Error('entityName, class_iri, and subject_iri_template are required')
  }

  database
    .prepare(
      `
      INSERT INTO entity_mappings (entity_name, class_iri, subject_iri_template)
      VALUES (?, ?, ?)
      ON CONFLICT(entity_name) DO UPDATE SET
        class_iri = excluded.class_iri,
        subject_iri_template = excluded.subject_iri_template
    `,
    )
    .run(normalizedEntityName, classIri, subjectIriTemplate)

  return database
    .prepare('SELECT * FROM entity_mappings WHERE entity_name = ?')
    .get(normalizedEntityName)
}

/* Delete a single entity mapping by entity_name. */
export function deleteEntityMapping(entityName) {
  const database = getDatabase()
  const normalizedEntityName = String(entityName || '').trim()
  if (!normalizedEntityName) {
    throw new Error('entityName is required')
  }

  const result = database.prepare('DELETE FROM entity_mappings WHERE entity_name = ?').run(normalizedEntityName)
  return { deleted: result.changes > 0, entity_name: normalizedEntityName }
}

/* Delete all entity mappings. */
export function deleteAllEntityMappings() {
  const database = getDatabase()
  const result = database.prepare('DELETE FROM entity_mappings').run()
  return { deletedCount: result.changes }
}

/* List property mappings (columns to OWL datatype properties). */
export function getPropertyMappings() {
  const database = getDatabase()
  return database
    .prepare('SELECT * FROM property_mappings ORDER BY entity_name ASC, column_name ASC')
    .all()
}

/* Insert or update a single property mapping. */
export function upsertPropertyMapping(entityName, columnName, inputData) {
  const database = getDatabase()
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const normalizedEntityName = String(entityName || '').trim()
  const normalizedColumnName = String(columnName || '').trim()

  const propertyIri = String(safeInputData.property_iri || '').trim()
  const datatypeIri = safeInputData.datatype_iri ? String(safeInputData.datatype_iri).trim() : null
  const languageTag = safeInputData.language_tag ? String(safeInputData.language_tag).trim() : null

  if (!normalizedEntityName || !normalizedColumnName || !propertyIri) {
    throw new Error('entityName, columnName, and property_iri are required')
  }

  database
    .prepare(
      `
      INSERT INTO property_mappings (entity_name, column_name, property_iri, datatype_iri, language_tag)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_name, column_name) DO UPDATE SET
        property_iri = excluded.property_iri,
        datatype_iri = excluded.datatype_iri,
        language_tag = excluded.language_tag
    `,
    )
    .run(normalizedEntityName, normalizedColumnName, propertyIri, datatypeIri, languageTag)

  return database
    .prepare('SELECT * FROM property_mappings WHERE entity_name = ? AND column_name = ?')
    .get(normalizedEntityName, normalizedColumnName)
}

/* Delete a property mapping. */
export function deletePropertyMapping(entityName, columnName) {
  const database = getDatabase()
  database
    .prepare('DELETE FROM property_mappings WHERE entity_name = ? AND column_name = ?')
    .run(String(entityName || '').trim(), String(columnName || '').trim())
}

/* Delete all property mappings. */
export function deleteAllPropertyMappings() {
  const database = getDatabase()
  const result = database.prepare('DELETE FROM property_mappings').run()
  return { deletedCount: result.changes }
}

