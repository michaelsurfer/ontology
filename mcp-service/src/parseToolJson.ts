import type { EntityField } from './dataLayerClient.js';

// Parse a JSON string into a plain object for row values or partial updates.
export function parseJsonObject(jsonText: string, argumentLabel: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`${argumentLabel} must be valid JSON`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${argumentLabel} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

// Parse a JSON array of entity field definitions for create_entity / update_entity.
export function parseEntityFieldsJson(jsonText: string): EntityField[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('fields_json must be valid JSON');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('fields_json must be a non-empty JSON array of field definitions');
  }

  const fields: EntityField[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Each field in fields_json must be an object');
    }
    const fieldObject = entry as Record<string, unknown>;
    const fieldName = String(fieldObject.field_name || '').trim();
    const fieldType = String(fieldObject.field_type || '').trim();
    if (!fieldName || !fieldType) {
      throw new Error('Each field requires field_name and field_type');
    }
    fields.push({
      field_name: fieldName,
      field_type: fieldType,
      is_required: Boolean(fieldObject.is_required),
      description: fieldObject.description ? String(fieldObject.description) : undefined,
      example: fieldObject.example ? String(fieldObject.example) : undefined,
      extraction_hint: fieldObject.extraction_hint
        ? String(fieldObject.extraction_hint)
        : undefined,
      is_identifier: Boolean(fieldObject.is_identifier),
    });
  }

  return fields;
}
