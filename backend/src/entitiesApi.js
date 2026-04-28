import { listCustomEntities } from './customEntities.js'

/* Return a combined list of builtin + custom entities with their column names. */
export function listAllEntitiesWithColumns() {
  const customEntities = listCustomEntities().map((entity) => ({
    entity_name: entity.entity_name,
    display_name: entity.display_name,
    is_custom: 1,
    fields: entity.fields || [],
  }))

  return customEntities.map((entity) => ({
    entity_name: entity.entity_name,
    display_name: entity.display_name,
    is_custom: entity.is_custom,
    columns: getCustomEntityColumns(entity.fields),
  }))
}

/* Use metadata (active fields) to decide which columns to show. */
function getCustomEntityColumns(fields) {
  const activeFieldNames = Array.isArray(fields)
    ? fields.filter((field) => field.is_active).map((field) => field.field_name)
    : []
  return ['id', ...activeFieldNames, 'created_at']
}

