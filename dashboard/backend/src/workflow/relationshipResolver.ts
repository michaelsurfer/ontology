import type { EntityRelationshipDefinition, EntityRowRecord } from '../types.js';
import type { RecordEntityRows } from './types.js';

export type RelationshipLinkPlan = {
  recordIndex: number;
  relationshipName: string;
  subjectEntityId: number;
  objectEntityId: number;
  subjectRowId: number;
  objectRowId: number;
  evidence: string;
};

// Resolve object row id by matching a payload field value to a field on existing object rows.
export function findObjectRowIdByFieldMapping(
  payloadObject: Record<string, unknown>,
  objectRows: EntityRowRecord[],
  payloadLinkField: string,
  objectEntityField: string,
): number | null {
  const trimmedPayloadField = String(payloadLinkField || '').trim();
  const trimmedObjectField = String(objectEntityField || '').trim();
  if (!trimmedPayloadField || !trimmedObjectField) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(payloadObject, trimmedPayloadField)) {
    return null;
  }

  const payloadValue = payloadObject[trimmedPayloadField];
  if (payloadValue === undefined || payloadValue === null) {
    return null;
  }

  const numericId = Number(payloadValue);
  if (Number.isFinite(numericId) && numericId > 0) {
    const matchedById = objectRows.find((row) => row.id === numericId);
    if (matchedById) {
      return matchedById.id;
    }
  }

  const searchText = String(payloadValue).trim().toLowerCase();
  if (!searchText) {
    return null;
  }

  const matchedRow = objectRows.find((row) => {
    const cellValue = row.values[trimmedObjectField];
    return String(cellValue || '').trim().toLowerCase() === searchText;
  });

  return matchedRow?.id ?? null;
}

// Build relationship link plans using an explicit entity relationship and field mapping.
export function planRelationshipLinks(options: {
  records: Record<string, unknown>[];
  recordEntityRows: RecordEntityRows;
  relationshipDefinition: EntityRelationshipDefinition;
  payloadLinkField: string;
  objectEntityField: string;
  objectRowsCache: Map<number, EntityRowRecord[]>;
}): RelationshipLinkPlan[] {
  const plans: RelationshipLinkPlan[] = [];
  const subjectEntityId = options.relationshipDefinition.subject_entity_id;
  const objectEntityId = options.relationshipDefinition.object_entity_id;
  const relationshipName = options.relationshipDefinition.relationship_name;

  for (let recordIndex = 0; recordIndex < options.records.length; recordIndex += 1) {
    const perRecord = options.recordEntityRows[recordIndex];
    if (!perRecord) {
      continue;
    }

    const subjectEntry = Object.values(perRecord).find((entry) => entry.entityId === subjectEntityId);
    if (!subjectEntry?.rowId) {
      continue;
    }

    const objectRows = options.objectRowsCache.get(objectEntityId) || [];
    const payloadObject = options.records[recordIndex];

    const objectRowId = findObjectRowIdByFieldMapping(
      payloadObject,
      objectRows,
      options.payloadLinkField,
      options.objectEntityField,
    );

    if (!objectRowId) {
      continue;
    }

    plans.push({
      recordIndex,
      relationshipName,
      subjectEntityId,
      objectEntityId,
      subjectRowId: subjectEntry.rowId,
      objectRowId,
      evidence: `payload.${options.payloadLinkField}_to_object.${options.objectEntityField}`,
    });
  }

  return plans;
}
