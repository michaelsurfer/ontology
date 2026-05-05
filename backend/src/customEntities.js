import { getDatabase } from './database.js'

const reservedEntityNames = new Set([
  'ontology_settings',
  'entity_mappings',
  'property_mappings',
  'relationship_definitions',
  'ontology_rules',
  'custom_entities',
  'custom_entity_fields',
])

/* Create a custom entity and its underlying SQL table. */
export function createCustomEntity({
  entity_name,
  display_name,
  fields,
  base_iri,
  is_link_table: isLinkTable = false,
  omit_ontology_metadata: omitOntologyMetadata = false,
}) {
  const database = getDatabase()

  const normalizedEntityName = normalizeIdentifier(entity_name)
  if (reservedEntityNames.has(normalizedEntityName)) {
    throw new Error(`Entity name is reserved or already used: ${normalizedEntityName}`)
  }

  if (getCustomEntityByName(normalizedEntityName)) {
    throw new Error(`Entity already exists: ${normalizedEntityName}`)
  }

  const normalizedDisplayName = String(display_name || normalizedEntityName).trim() || normalizedEntityName
  const normalizedFields = normalizeFields(fields)

  const createEntityTransaction = database.transaction(() => {
    const entityResult = database
      .prepare('INSERT INTO custom_entities (entity_name, display_name, is_link_table) VALUES (?, ?, ?)')
      .run(normalizedEntityName, normalizedDisplayName, isLinkTable ? 1 : 0)

    const customEntityId = entityResult.lastInsertRowid

    const insertField = database.prepare(`
      INSERT INTO custom_entity_fields (custom_entity_id, field_name, field_type, is_required)
      VALUES (?, ?, ?, ?)
    `)

    for (const field of normalizedFields) {
      insertField.run(customEntityId, field.field_name, field.field_type, field.is_required ? 1 : 0)
    }

    createCustomEntityTable(database, {
      tableName: normalizedEntityName,
      fields: normalizedFields,
    })

    if (!omitOntologyMetadata) {
      const baseIri = String(base_iri || '').trim() || 'http://example.com/context#'

      database
        .prepare(
          `
        INSERT INTO entity_mappings (entity_name, class_iri, subject_iri_template)
        VALUES (?, ?, ?)
      `,
        )
        .run(
          normalizedEntityName,
          `${baseIri}${toPascalCase(normalizedEntityName)}`,
          `http://example.com/resource/${normalizedEntityName}/{id}`,
        )

      const insertPropertyMapping = database.prepare(`
      INSERT OR IGNORE INTO property_mappings (entity_name, column_name, property_iri, datatype_iri, language_tag)
      VALUES (?, ?, ?, ?, ?)
    `)

      for (const field of normalizedFields) {
        insertPropertyMapping.run(
          normalizedEntityName,
          field.field_name,
          `${baseIri}${toCamelCase(field.field_name)}`,
          sqliteTypeToXsdDatatype(field.field_type),
          null,
        )
      }
    }

    return getCustomEntityByName(normalizedEntityName)
  })

  return createEntityTransaction()
}

/* Turn a relationship label into a short SQL-safe slug for link table names. */
function slugifyRelationshipNameForLinkTable(relationshipName) {
  const raw = String(relationshipName || '').trim().toLowerCase()
  let slug = raw
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!slug || !/^[a-z]/.test(slug)) {
    slug = `rel${slug ? `_${slug}` : ''}`.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'rel'
  }
  if (!/^[a-z][a-z0-9_]*$/.test(slug)) {
    slug = 'rel'
  }
  if (slug.length > 28) {
    slug = slug.slice(0, 28).replace(/_+$/, '') || 'rel'
  }
  return slug
}

/* Create a link table for a relationship (subject id + object id); hidden from Objects list. */
export function createAutomatedLinkTableEntity({ subject_entity, object_entity, relationship_name, base_iri }) {
  const subjectName = normalizeIdentifier(subject_entity)
  const objectName = normalizeIdentifier(object_entity)
  const relSlug = slugifyRelationshipNameForLinkTable(relationship_name)
  const junctionSubjectColumn = `${subjectName}_id`
  const junctionObjectColumn = `${objectName}_id`

  let baseTableName = `link_${subjectName}_${relSlug}_${objectName}`
  if (baseTableName.length > 52) {
    baseTableName = baseTableName.slice(0, 52).replace(/_+$/, '') || `link_${subjectName}_${objectName}`
  }

  let tableName = baseTableName
  let suffix = 2
  while (getCustomEntityByName(tableName) || reservedEntityNames.has(tableName)) {
    const extra = `_${suffix}`
    tableName = `${baseTableName.slice(0, Math.max(1, 63 - extra.length))}${extra}`
    suffix += 1
  }

  const displayName = `Link: ${String(relationship_name || '').trim() || `${subjectName} ↔ ${objectName}`}`

  createCustomEntity({
    entity_name: tableName,
    display_name: displayName,
    fields: [
      { field_name: junctionSubjectColumn, field_type: 'INTEGER', is_required: false },
      { field_name: junctionObjectColumn, field_type: 'INTEGER', is_required: false },
    ],
    base_iri,
    is_link_table: true,
    omit_ontology_metadata: true,
  })

  return {
    entity_name: tableName,
    junction_subject_column: junctionSubjectColumn,
    junction_object_column: junctionObjectColumn,
  }
}

/* Remove a link table created for relationships only (does not delete relationship_definitions rows). */
export function deleteAutomatedLinkTableOnly({ entity_name }) {
  const database = getDatabase()
  const normalizedName = normalizeIdentifier(entity_name)
  const entity = database
    .prepare('SELECT id, entity_name, is_link_table FROM custom_entities WHERE entity_name = ?')
    .get(normalizedName)

  if (!entity) {
    return { deleted: false }
  }

  if (!Number(entity.is_link_table || 0)) {
    throw new Error('Entity is not an automated link table')
  }

  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM property_mappings WHERE entity_name = ?').run(entity.entity_name)
    database.prepare('DELETE FROM entity_mappings WHERE entity_name = ?').run(entity.entity_name)
    database.exec(`DROP TABLE IF EXISTS "${entity.entity_name}"`)
    database.prepare('DELETE FROM custom_entities WHERE id = ?').run(entity.id)
  })

  transaction()
  return { deleted: true, entity_name: entity.entity_name }
}

/* Return a list of custom entities with fields. */
export function listCustomEntities() {
  const database = getDatabase()
  const entities = database
    .prepare(
      'SELECT id, entity_name, display_name, created_at FROM custom_entities WHERE COALESCE(is_link_table, 0) = 0 ORDER BY created_at DESC',
    )
    .all()

  return entities.map((entity) => ({
    ...entity,
    fields: database
      .prepare(
        'SELECT id, field_name, field_type, is_required, is_active, created_at FROM custom_entity_fields WHERE custom_entity_id = ? ORDER BY id ASC',
      )
      .all(entity.id),
  }))
}

/* Fetch a single custom entity by entity_name, with fields. */
export function getCustomEntityByName(entityName) {
  const database = getDatabase()
  const normalizedName = normalizeIdentifier(entityName)

  const entity = database
    .prepare('SELECT id, entity_name, display_name, created_at FROM custom_entities WHERE entity_name = ?')
    .get(normalizedName)

  if (!entity) {
    return null
  }

  const fields = database
    .prepare(
      'SELECT id, field_name, field_type, is_required, is_active, created_at FROM custom_entity_fields WHERE custom_entity_id = ? ORDER BY id ASC',
    )
    .all(entity.id)

  return { ...entity, fields }
}

/* Add a field to an existing custom entity (adds a real SQL column). */
export function addCustomEntityField({ entity_name, field_name, field_type, is_required, base_iri }) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entity_name)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const normalizedField = {
    field_name: normalizeIdentifier(field_name),
    field_type: normalizeSqliteType(field_type),
    is_required: Boolean(is_required),
  }

  const reservedColumns = new Set(['id', 'created_at'])
  if (reservedColumns.has(normalizedField.field_name)) {
    throw new Error(`Field name is reserved: ${normalizedField.field_name}`)
  }

  const isDuplicateFieldName = entity.fields.some(
    (existingField) => existingField.field_name === normalizedField.field_name,
  )
  if (isDuplicateFieldName) {
    throw new Error(`Field already exists: ${normalizedField.field_name}`)
  }

  const baseIri = String(base_iri || '').trim() || 'http://example.com/context#'

  const transaction = database.transaction(() => {
    database
      .prepare(
        `
        INSERT INTO custom_entity_fields (custom_entity_id, field_name, field_type, is_required, is_active)
        VALUES (?, ?, ?, ?, 1)
      `,
      )
      .run(entity.id, normalizedField.field_name, normalizedField.field_type, normalizedField.is_required ? 1 : 0)

    // SQLite allows ADD COLUMN but NOT NULL is tricky for existing rows; we keep it nullable at DB level.
    database.exec(
      `ALTER TABLE "${entity.entity_name}" ADD COLUMN "${normalizedField.field_name}" ${normalizedField.field_type}`,
    )

    database
      .prepare(
        `
        INSERT OR IGNORE INTO property_mappings (entity_name, column_name, property_iri, datatype_iri, language_tag)
        VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(
        entity.entity_name,
        normalizedField.field_name,
        `${baseIri}${toCamelCase(normalizedField.field_name)}`,
        sqliteTypeToXsdDatatype(normalizedField.field_type),
        null,
      )

    return getCustomEntityByName(entity.entity_name)
  })

  return transaction()
}

/* Update a custom field's metadata (required/active). */
export function updateCustomEntityField({ entity_name, field_id, is_required, is_active }) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entity_name)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const field = database
    .prepare('SELECT * FROM custom_entity_fields WHERE id = ? AND custom_entity_id = ?')
    .get(Number(field_id), entity.id)

  if (!field) {
    throw new Error('Field not found')
  }

  const nextIsRequired = is_required === undefined ? field.is_required : is_required ? 1 : 0
  const nextIsActive = is_active === undefined ? field.is_active : is_active ? 1 : 0

  const transaction = database.transaction(() => {
    database
      .prepare('UPDATE custom_entity_fields SET is_required = ?, is_active = ? WHERE id = ?')
      .run(nextIsRequired, nextIsActive, Number(field_id))

    // If a field is disabled, remove its property mapping so it no longer appears in RDF export.
    if (nextIsActive === 0) {
      database
        .prepare('DELETE FROM property_mappings WHERE entity_name = ? AND column_name = ?')
        .run(entity.entity_name, field.field_name)
    }

    return getCustomEntityByName(entity.entity_name)
  })

  return transaction()
}

/* Delete a custom entity (drops SQL table and removes metadata/mappings). */
export function deleteCustomEntity({ entity_name }) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entity_name)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const linkMetaRow = database.prepare('SELECT is_link_table FROM custom_entities WHERE id = ?').get(entity.id)
  if (linkMetaRow && Number(linkMetaRow.is_link_table || 0)) {
    throw new Error('Link tables created for relationships cannot be deleted here. Remove the relationship first.')
  }

  const transaction = database.transaction(() => {
    // Remove relationships that reference this entity
    database
      .prepare(
        'DELETE FROM relationship_definitions WHERE subject_entity = ? OR object_entity = ? OR junction_entity = ?',
      )
      .run(entity.entity_name, entity.entity_name, entity.entity_name)

    // Remove rules targeting this entity
    database.prepare('DELETE FROM ontology_rules WHERE target_entity = ?').run(entity.entity_name)

    // Remove mappings
    database.prepare('DELETE FROM property_mappings WHERE entity_name = ?').run(entity.entity_name)
    database.prepare('DELETE FROM entity_mappings WHERE entity_name = ?').run(entity.entity_name)

    // Drop the SQL table
    database.exec(`DROP TABLE IF EXISTS "${entity.entity_name}"`)

    // Remove custom entity metadata (fields are cascaded)
    database.prepare('DELETE FROM custom_entities WHERE id = ?').run(entity.id)

    return { deleted: true, entity_name: entity.entity_name }
  })

  return transaction()
}

/* Create the underlying SQLite table for a custom entity. */
function createCustomEntityTable(database, { tableName, fields }) {
  const safeTableName = normalizeIdentifier(tableName)

  const columnDefinitions = [
    '"id" INTEGER PRIMARY KEY AUTOINCREMENT',
    '"created_at" TEXT NOT NULL DEFAULT (datetime(\'now\'))',
  ]

  for (const field of fields) {
    const safeColumnName = normalizeIdentifier(field.field_name)
    const sqliteType = normalizeSqliteType(field.field_type)
    const notNullClause = field.is_required ? ' NOT NULL' : ''
    columnDefinitions.push(`"${safeColumnName}" ${sqliteType}${notNullClause}`)
  }

  database.exec(`CREATE TABLE IF NOT EXISTS "${safeTableName}" (${columnDefinitions.join(', ')});`)
}

/* Normalize and validate entity/field identifiers. */
function normalizeIdentifier(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]*$/.test(normalizedValue)) {
    throw new Error('Identifier must match /^[a-z][a-z0-9_]*$/')
  }
  return normalizedValue
}

/* Normalize a field list for entity creation. */
function normalizeFields(fields) {
  const safeFields = Array.isArray(fields) ? fields : []

  if (safeFields.length === 0) {
    throw new Error('At least one field is required')
  }

  const normalizedFields = safeFields.map((field) => ({
    field_name: normalizeIdentifier(field.field_name),
    field_type: normalizeSqliteType(field.field_type),
    is_required: Boolean(field.is_required),
  }))

  const uniqueNames = new Set(normalizedFields.map((field) => field.field_name))
  if (uniqueNames.size !== normalizedFields.length) {
    throw new Error('Field names must be unique')
  }

  const reservedColumns = new Set(['id', 'created_at'])
  for (const field of normalizedFields) {
    if (reservedColumns.has(field.field_name)) {
      throw new Error(`Field name is reserved: ${field.field_name}`)
    }
  }

  return normalizedFields
}

/* Normalize user-provided SQLite types to a safe allowlist. */
function normalizeSqliteType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  const allowedTypes = new Set(['TEXT', 'INTEGER', 'REAL'])
  if (!allowedTypes.has(normalizedValue)) {
    throw new Error('field_type must be one of: TEXT, INTEGER, REAL')
  }
  return normalizedValue
}

/* Map SQLite type to an XSD datatype IRI for RDF export. */
function sqliteTypeToXsdDatatype(sqliteType) {
  const normalizedType = String(sqliteType || '').trim().toUpperCase()
  if (normalizedType === 'INTEGER') {
    return 'http://www.w3.org/2001/XMLSchema#integer'
  }
  if (normalizedType === 'REAL') {
    return 'http://www.w3.org/2001/XMLSchema#decimal'
  }
  return 'http://www.w3.org/2001/XMLSchema#string'
}

/* Convert snake_case to camelCase for predicate local names. */
function toCamelCase(value) {
  const parts = String(value || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .split('_')
    .filter(Boolean)

  if (parts.length === 0) {
    return 'property'
  }

  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((item) => item.slice(0, 1).toUpperCase() + item.slice(1).toLowerCase())
      .join('')
  )
}

/* Convert snake_case to PascalCase for class local names. */
function toPascalCase(value) {
  const parts = String(value || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .split('_')
    .filter(Boolean)

  if (parts.length === 0) {
    return 'Entity'
  }

  return parts.map((item) => item.slice(0, 1).toUpperCase() + item.slice(1).toLowerCase()).join('')
}

