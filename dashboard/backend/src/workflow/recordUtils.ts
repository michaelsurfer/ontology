// Convert camelCase keys to snake_case for matching entity fields.
export function camelToSnakeIdentifier(value: string): string {
  return String(value || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Remove routing envelope keys from a payload record.
export function stripEnvelopeKeys(recordObject: Record<string, unknown>): Record<string, unknown> {
  const safeRecord = { ...recordObject };
  delete safeRecord.source;
  delete safeRecord.sourceId;
  delete safeRecord.meta;
  return safeRecord;
}

// Normalize HTTP body into an array of plain record objects.
export function normalizeBodyToRecords(body: unknown): Record<string, unknown>[] {
  if (body === undefined || body === null) {
    return [];
  }
  if (Array.isArray(body)) {
    return body
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => stripEnvelopeKeys(item as Record<string, unknown>));
  }
  if (typeof body !== 'object') {
    return [];
  }

  const bodyObject = body as Record<string, unknown>;
  if (Array.isArray(bodyObject.records)) {
    return bodyObject.records
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => stripEnvelopeKeys(item as Record<string, unknown>));
  }

  const nested =
    bodyObject.data && typeof bodyObject.data === 'object' && !Array.isArray(bodyObject.data)
      ? (bodyObject.data as Record<string, unknown>)
      : bodyObject.payload && typeof bodyObject.payload === 'object' && !Array.isArray(bodyObject.payload)
        ? (bodyObject.payload as Record<string, unknown>)
        : bodyObject.attributes &&
            typeof bodyObject.attributes === 'object' &&
            !Array.isArray(bodyObject.attributes)
          ? (bodyObject.attributes as Record<string, unknown>)
          : null;

  if (nested) {
    return [stripEnvelopeKeys(nested)];
  }

  const keys = Object.keys(bodyObject).filter((key) => !['records', 'source', 'meta'].includes(key));
  if (keys.length > 0 && keys.every((key) => typeof bodyObject[key] !== 'object' || bodyObject[key] === null)) {
    return [stripEnvelopeKeys(bodyObject)];
  }

  return [];
}

// Build row values from payload using active field names on an entity.
export function extractRowForEntity(
  payloadObject: Record<string, unknown>,
  activeFieldNames: string[],
): Record<string, unknown> {
  const lookup: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(payloadObject)) {
    const trimmed = String(rawKey || '').trim();
    if (!trimmed || trimmed === 'id' || trimmed === 'created_at') {
      continue;
    }
    const lower = trimmed.toLowerCase();
    const snake = camelToSnakeIdentifier(trimmed);
    lookup[lower] = rawValue;
    if (snake) {
      lookup[snake] = rawValue;
    }
  }

  const rowValues: Record<string, unknown> = {};
  for (const fieldName of activeFieldNames) {
    if (!fieldName) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(payloadObject, fieldName)) {
      rowValues[fieldName] = payloadObject[fieldName];
    } else if (lookup[fieldName] !== undefined) {
      rowValues[fieldName] = lookup[fieldName];
    }
  }
  return rowValues;
}

// Count how many active fields receive a value from the payload.
export function matchScoreForEntity(
  payloadObject: Record<string, unknown>,
  activeFieldNames: string[],
): number {
  const rowValues = extractRowForEntity(payloadObject, activeFieldNames);
  return Object.keys(rowValues).length;
}
