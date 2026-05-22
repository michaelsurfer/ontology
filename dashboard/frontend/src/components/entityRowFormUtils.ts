import type { EntityFieldDefinition, FieldType } from '../types';

// Build empty string values for each active entity field.
export function buildEmptyFormValues(activeFields: EntityFieldDefinition[]): Record<string, string> {
  const formValues: Record<string, string> = {};
  for (const field of activeFields) {
    formValues[field.field_name] = '';
  }
  return formValues;
}

// Populate form strings from an existing row's values.
export function formValuesFromRow(
  activeFields: EntityFieldDefinition[],
  rowValues: Record<string, unknown>,
): Record<string, string> {
  const formValues = buildEmptyFormValues(activeFields);
  for (const field of activeFields) {
    const cellValue = rowValues[field.field_name];
    if (cellValue === null || cellValue === undefined) {
      continue;
    }
    formValues[field.field_name] = String(cellValue);
  }
  return formValues;
}

// Convert form strings to typed row values for the data layer API.
export function convertFormValuesToRow(
  activeFields: EntityFieldDefinition[],
  formValues: Record<string, string>,
): { ok: true; values: Record<string, unknown> } | { ok: false; errorMessage: string } {
  const rowValues: Record<string, unknown> = {};

  for (const field of activeFields) {
    const rawText = String(formValues[field.field_name] ?? '').trim();

    if (!rawText) {
      if (field.is_required) {
        return {
          ok: false,
          errorMessage: `"${field.field_name}" is required.`,
        };
      }
      continue;
    }

    if (field.field_type === 'INTEGER') {
      const parsedInteger = Number(rawText);
      if (!Number.isFinite(parsedInteger) || !Number.isInteger(parsedInteger)) {
        return {
          ok: false,
          errorMessage: `"${field.field_name}" must be a whole number.`,
        };
      }
      rowValues[field.field_name] = parsedInteger;
      continue;
    }

    if (field.field_type === 'REAL') {
      const parsedNumber = Number(rawText);
      if (!Number.isFinite(parsedNumber)) {
        return {
          ok: false,
          errorMessage: `"${field.field_name}" must be a number.`,
        };
      }
      rowValues[field.field_name] = parsedNumber;
      continue;
    }

    rowValues[field.field_name] = rawText;
  }

  return { ok: true, values: rowValues };
}

// Return HTML input type and step for a field type.
export function inputPropsForFieldType(fieldType: FieldType): {
  type: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  step?: string;
} {
  if (fieldType === 'INTEGER') {
    return { type: 'number', inputMode: 'numeric', step: '1' };
  }
  if (fieldType === 'REAL') {
    return { type: 'number', inputMode: 'decimal', step: 'any' };
  }
  return { type: 'text' };
}

// Format a cell value for read-only table display.
export function formatCellDisplay(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
