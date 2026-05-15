/* Shared helpers for create-object forms and field validation (mirrors backend naming rules). */

/* Create a blank field entry. */
export function createEmptyField() {
  return {
    field_name: '',
    field_type: 'TEXT',
    is_required: false,
  }
}

/* Create a blank custom entity form state. */
export function createEmptyEntityForm() {
  return {
    entity_name: '',
    display_name: '',
    fields: [createEmptyField()],
  }
}

/* Validate a field/column name using the same rules as the API (snake_case, lowercase). */
export function getFieldNameErrorText(fieldName) {
  const normalized = String(fieldName || '').trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  const reservedColumns = new Set(['id', 'created_at'])
  if (reservedColumns.has(normalized)) {
    return `Field name is reserved: ${normalized}`
  }

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return 'Invalid format. Use: /^[a-z][a-z0-9_]*$/'
  }

  return ''
}

/* Ensure a new field name is not already defined on this object. */
export function getDuplicateFieldNameErrorText({ fieldName, existingFields }) {
  const normalized = String(fieldName || '').trim().toLowerCase()
  if (!normalized || !/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return ''
  }

  const list = Array.isArray(existingFields) ? existingFields : []
  const exists = list.some((field) => String(field?.field_name || '').trim().toLowerCase() === normalized)
  if (exists) {
    return `Field already exists: ${normalized}`
  }

  return ''
}

/* Validate the entity name for format and uniqueness against existing entities. */
export function getEntityNameErrorText({ entityName, existingEntities }) {
  const normalized = String(entityName || '').trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return 'Invalid format. Use: /^[a-z][a-z0-9_]*$/'
  }

  const list = Array.isArray(existingEntities) ? existingEntities : []
  const exists = list.some((entity) => String(entity?.entity_name || '').trim().toLowerCase() === normalized)
  if (exists) {
    return `Entity name already exists: ${normalized}`
  }

  return ''
}
