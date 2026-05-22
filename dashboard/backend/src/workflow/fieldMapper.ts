import type { FieldMappingRule } from './types.js';

// Normalize mapping rules from persisted node JSON.
export function normalizeFieldMappings(rawMappings: unknown): FieldMappingRule[] {
  if (!Array.isArray(rawMappings)) {
    return [];
  }

  return rawMappings
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const mappingObject = entry as Record<string, unknown>;
      const sourceField = String(mappingObject.sourceField || '').trim();
      const targetField = String(mappingObject.targetField || '').trim();
      if (!sourceField || !targetField) {
        return null;
      }
      const targetMode = mappingObject.targetMode === 'entity' ? 'entity' : 'custom';
      return { sourceField, targetField, targetMode };
    })
    .filter((mapping): mapping is FieldMappingRule => mapping !== null);
}

// Apply field rename/copy rules to a single incoming JSON record.
export function applyFieldMappingsToRecord(
  record: Record<string, unknown>,
  mappings: FieldMappingRule[],
): Record<string, unknown> {
  const nextRecord = { ...record };

  for (const mapping of mappings) {
    if (!Object.prototype.hasOwnProperty.call(record, mapping.sourceField)) {
      continue;
    }

    nextRecord[mapping.targetField] = record[mapping.sourceField];
    if (mapping.sourceField !== mapping.targetField) {
      delete nextRecord[mapping.sourceField];
    }
  }

  return nextRecord;
}

// Apply field mappings to every record in the workflow batch.
export function applyFieldMappingsToRecords(
  records: Record<string, unknown>[],
  mappings: FieldMappingRule[],
): { records: Record<string, unknown>[]; appliedMappingCount: number } {
  let appliedMappingCount = 0;
  const nextRecords = records.map((record) => {
    let recordAppliedCount = 0;
    const nextRecord = { ...record };

    for (const mapping of mappings) {
      if (!Object.prototype.hasOwnProperty.call(record, mapping.sourceField)) {
        continue;
      }
      nextRecord[mapping.targetField] = record[mapping.sourceField];
      if (mapping.sourceField !== mapping.targetField) {
        delete nextRecord[mapping.sourceField];
      }
      recordAppliedCount += 1;
    }

    appliedMappingCount += recordAppliedCount;
    return nextRecord;
  });

  return { records: nextRecords, appliedMappingCount };
}
