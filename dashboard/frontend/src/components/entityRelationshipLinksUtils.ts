import type {
  EntityRelationshipDefinition,
  EntityRowRecord,
  RelationshipRecord,
} from '../types';

export type ResolvedRelationshipLink = {
  recordId: number;
  relationshipName: string;
  subjectLabel: string;
  objectLabel: string;
};

// Keep row records that match a schema-level entity relationship definition.
export function filterRelationshipRecordsForDefinition(
  definition: EntityRelationshipDefinition,
  records: RelationshipRecord[],
): RelationshipRecord[] {
  return records.filter(
    (record) =>
      record.relationship_name === definition.relationship_name &&
      record.subject_entity_id === definition.subject_entity_id &&
      record.object_entity_id === definition.object_entity_id,
  );
}

const defaultRowLabelFieldName = 'name';

// Read a single field value from a row as a display string.
function formatRowFieldValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

// Human-readable label for one entity row (identifier field, then "name", then any value).
export function formatEntityRowLabel(
  row: EntityRowRecord,
  entityName: string,
  fieldDefinitions?: Array<{ field_name: string; is_identifier?: boolean }>,
): string {
  if (fieldDefinitions && fieldDefinitions.length > 0) {
    const identifierField = fieldDefinitions.find((field) => field.is_identifier);
    if (identifierField) {
      const identifierValue = formatRowFieldValue(row.values[identifierField.field_name]);
      if (identifierValue) {
        return identifierValue;
      }
    }
  }

  const preferredValue = formatRowFieldValue(row.values[defaultRowLabelFieldName]);
  if (preferredValue) {
    return preferredValue;
  }

  for (const [fieldName, value] of Object.entries(row.values)) {
    if (fieldName === defaultRowLabelFieldName) {
      continue;
    }
    const formatted = formatRowFieldValue(value);
    if (formatted) {
      return formatted;
    }
  }

  return `${entityName} #${row.id}`;
}

// Build a map of row id → display label for one entity's rows.
export function buildRowLabelMap(
  rows: EntityRowRecord[],
  entityName: string,
  fieldDefinitions?: Array<{ field_name: string; is_identifier?: boolean }>,
): Map<number, string> {
  const labelMap = new Map<number, string>();
  for (const row of rows) {
    labelMap.set(row.id, formatEntityRowLabel(row, entityName, fieldDefinitions));
  }
  return labelMap;
}

// Resolve row-level links into labels for table and graph views.
export function buildResolvedRelationshipLinks(
  definition: EntityRelationshipDefinition,
  records: RelationshipRecord[],
  subjectRowLabelById: Map<number, string>,
  objectRowLabelById: Map<number, string>,
  subjectEntityName: string,
  objectEntityName: string,
): ResolvedRelationshipLink[] {
  const matchingRecords = filterRelationshipRecordsForDefinition(definition, records);

  return matchingRecords.map((record) => ({
    recordId: record.id,
    relationshipName: record.relationship_name,
    subjectLabel:
      subjectRowLabelById.get(record.subject_row_id) ||
      `${subjectEntityName} #${record.subject_row_id}`,
    objectLabel:
      objectRowLabelById.get(record.object_row_id) ||
      `${objectEntityName} #${record.object_row_id}`,
  }));
}
