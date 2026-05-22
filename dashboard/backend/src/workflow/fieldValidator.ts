import type { FieldValidationFormat, FieldValidationRule } from './types.js';

export type FieldValidationFailure = {
  field: string;
  message: string;
};

export type RecordValidationOutcome = {
  ok: boolean;
  failures: FieldValidationFailure[];
  summaryReason: string;
};

// Normalize validation rules from persisted node JSON.
export function normalizeValidationRules(rawRules: unknown): FieldValidationRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const ruleObject = entry as Record<string, unknown>;
      const jsonField = String(ruleObject.jsonField || '').trim();
      if (!jsonField) {
        return null;
      }

      const formatRaw = String(ruleObject.format || 'text').trim().toLowerCase();
      const allowedFormats: FieldValidationFormat[] = [
        'required',
        'text',
        'number',
        'integer',
        'email',
        'date',
      ];
      const format = allowedFormats.includes(formatRaw as FieldValidationFormat)
        ? (formatRaw as FieldValidationFormat)
        : 'text';

      const minValueRaw = ruleObject.minValue;
      const maxValueRaw = ruleObject.maxValue;
      const minValue =
        minValueRaw !== undefined && minValueRaw !== null && minValueRaw !== ''
          ? Number(minValueRaw)
          : null;
      const maxValue =
        maxValueRaw !== undefined && maxValueRaw !== null && maxValueRaw !== ''
          ? Number(maxValueRaw)
          : null;

      const rule: FieldValidationRule = {
        jsonField,
        format,
        minValue: Number.isFinite(minValue) ? minValue : null,
        maxValue: Number.isFinite(maxValue) ? maxValue : null,
      };
      return rule;
    })
    .filter((rule): rule is FieldValidationRule => rule !== null);
}

// Read a value from the payload by JSON field name.
function readPayloadFieldValue(
  payloadObject: Record<string, unknown>,
  jsonField: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(payloadObject, jsonField)) {
    return payloadObject[jsonField];
  }
  return undefined;
}

// Check whether a payload value is present and non-empty.
function hasNonEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}

// Validate email with a simple pattern.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Validate ISO date YYYY-MM-DD.
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

// Validate one field rule against a payload record.
function validateFieldRule(
  payloadObject: Record<string, unknown>,
  rule: FieldValidationRule,
): FieldValidationFailure | null {
  const fieldValue = readPayloadFieldValue(payloadObject, rule.jsonField);

  if (rule.format === 'required') {
    if (!hasNonEmptyValue(fieldValue)) {
      return {
        field: rule.jsonField,
        message: 'Field is required',
      };
    }
    return null;
  }

  if (!hasNonEmptyValue(fieldValue)) {
    return null;
  }

  const textValue = String(fieldValue).trim();

  if (rule.format === 'text') {
    return null;
  }

  if (rule.format === 'email') {
    if (!isValidEmail(textValue)) {
      return { field: rule.jsonField, message: 'Must be a valid email address' };
    }
    return null;
  }

  if (rule.format === 'date') {
    if (!isValidIsoDate(textValue)) {
      return { field: rule.jsonField, message: 'Must be a date (YYYY-MM-DD)' };
    }
    return null;
  }

  if (rule.format === 'number' || rule.format === 'integer') {
    const numericValue = Number(textValue);
    if (!Number.isFinite(numericValue)) {
      return { field: rule.jsonField, message: 'Must be a number' };
    }
    if (rule.format === 'integer' && !Number.isInteger(numericValue)) {
      return { field: rule.jsonField, message: 'Must be a whole number' };
    }
    const minBound = rule.minValue ?? null;
    const maxBound = rule.maxValue ?? null;
    if (minBound !== null && numericValue < minBound) {
      return {
        field: rule.jsonField,
        message: `Must be >= ${minBound}`,
      };
    }
    if (maxBound !== null && numericValue > maxBound) {
      return {
        field: rule.jsonField,
        message: `Must be <= ${maxBound}`,
      };
    }
    return null;
  }

  return null;
}

// Validate one incoming record against all configured field rules.
export function validateRecordAgainstRules(
  payloadObject: Record<string, unknown>,
  rules: FieldValidationRule[],
): RecordValidationOutcome {
  if (rules.length === 0) {
    return {
      ok: true,
      failures: [],
      summaryReason: '',
    };
  }

  const failures: FieldValidationFailure[] = [];
  for (const rule of rules) {
    const failure = validateFieldRule(payloadObject, rule);
    if (failure) {
      failures.push(failure);
    }
  }

  if (failures.length === 0) {
    return {
      ok: true,
      failures: [],
      summaryReason: '',
    };
  }

  const summaryReason = `validation_failed: ${failures
    .map((failure) => `${failure.field} (${failure.message})`)
    .join('; ')}`;

  return {
    ok: false,
    failures,
    summaryReason,
  };
}
