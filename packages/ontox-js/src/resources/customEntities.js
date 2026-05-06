/* Create a custom entities resource for managing dynamic SQL tables. */
export function createCustomEntitiesResource({ httpClient }) {
  return {
    /* List custom entities and their fields. */
    async list() {
      return await httpClient.requestJson({ method: 'GET', path: '/api/custom-entities' })
    },

    /* Create a new custom entity (creates a real SQL table). */
    async create({ entityName, displayName, fields }) {
      return await httpClient.requestJson({
        method: 'POST',
        path: '/api/custom-entities',
        body: {
          entity_name: entityName,
          display_name: displayName,
          fields,
        },
      })
    },

    /* Delete a custom entity (drops SQL table). */
    async delete({ entityName }) {
      return await httpClient.requestJson({
        method: 'DELETE',
        path: `/api/custom-entities/${encodeURIComponent(entityName)}`,
      })
    },

    /* Add a field to a custom entity (ALTER TABLE ADD COLUMN). */
    async addField({ entityName, fieldName, fieldType, isRequired }) {
      return await httpClient.requestJson({
        method: 'POST',
        path: `/api/custom-entities/${encodeURIComponent(entityName)}/fields`,
        body: {
          field_name: fieldName,
          field_type: fieldType,
          is_required: Boolean(isRequired),
        },
      })
    },

    /* Update a custom field (enable/disable, required). */
    async updateField({ entityName, fieldId, isActive, isRequired }) {
      return await httpClient.requestJson({
        method: 'PUT',
        path: `/api/custom-entities/${encodeURIComponent(entityName)}/fields/${encodeURIComponent(fieldId)}`,
        body: {
          is_active: isActive === undefined ? undefined : isActive ? 1 : 0,
          is_required: isRequired === undefined ? undefined : isRequired ? 1 : 0,
        },
      })
    },

    /* Delete a field (drops SQL column and related mappings; cannot remove the last field). */
    async deleteField({ entityName, fieldId }) {
      return await httpClient.requestJson({
        method: 'DELETE',
        path: `/api/custom-entities/${encodeURIComponent(entityName)}/fields/${encodeURIComponent(fieldId)}`,
      })
    },
  }
}

