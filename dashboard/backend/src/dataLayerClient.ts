import type {
  EntityDefinition,
  EntityRelationshipDefinition,
  EntityRowRecord,
  EntitySummary,
  PolicyRolesResponse,
  RelationshipRecord,
  TurtleExportRequest,
} from './types.js';

const defaultBaseUrl = 'http://127.0.0.1:8182';

// Resolve data-layer-service base URL from environment.
export function getDataLayerBaseUrl(): string {
  return String(process.env.DATA_LAYER_URL || defaultBaseUrl).replace(/\/+$/, '');
}

// Perform a JSON HTTP call against the data-layer-service.
async function requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getDataLayerBaseUrl()}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseText = await response.text();
  let parsed: unknown = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }
  }

  if (!response.ok) {
    const errorMessage =
      parsed &&
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return parsed as T;
}

// Perform a Turtle export request and return plain text.
async function requestTurtle(body: TurtleExportRequest): Promise<string> {
  const response = await fetch(`${getDataLayerBaseUrl()}/rdf/turtle`, {
    method: 'POST',
    headers: {
      Accept: 'text/turtle',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(responseText) as { error?: string };
      if (parsed.error) {
        errorMessage = parsed.error;
      }
    } catch {
      if (responseText) {
        errorMessage = responseText;
      }
    }
    throw new Error(errorMessage);
  }

  return responseText;
}

export const dataLayerClient = {
  health: () => requestJson<{ ok: boolean }>('GET', '/health'),

  listEntities: () => requestJson<EntitySummary[]>('GET', '/entities'),

  getEntity: (entityId: number) => requestJson<EntityDefinition>('GET', `/entities/${entityId}`),

  createEntity: (body: {
    name: string;
    display_name?: string;
    fields: Array<{
      field_name: string;
      field_type: string;
      is_required?: boolean;
      description?: string;
      example?: string;
      extraction_hint?: string;
      is_identifier?: boolean;
      read_role?: string;
    }>;
  }) => requestJson<EntityDefinition>('POST', '/entities', body),

  updateEntity: (
    entityId: number,
    body: {
      name?: string;
      display_name?: string;
      fields?: Array<{
        field_name: string;
        field_type: string;
        is_required?: boolean;
        description?: string;
        example?: string;
        extraction_hint?: string;
        is_identifier?: boolean;
        read_role?: string;
      }>;
    },
  ) => requestJson<EntityDefinition>('PUT', `/entities/${entityId}`, body),

  deleteEntity: (entityId: number) =>
    requestJson<{ ok: boolean }>('DELETE', `/entities/${entityId}`),

  listEntityRows: (entityId: number) =>
    requestJson<EntityRowRecord[]>('GET', `/entities/${entityId}/data`),

  createEntityRow: (entityId: number, values: Record<string, unknown>) =>
    requestJson<EntityRowRecord>('POST', `/entities/${entityId}/data`, { values }),

  updateEntityRow: (entityId: number, rowId: number, values: Record<string, unknown>) =>
    requestJson<EntityRowRecord>('PUT', `/entities/${entityId}/data/${rowId}`, { values }),

  deleteEntityRow: (entityId: number, rowId: number) =>
    requestJson<{ ok: boolean }>('DELETE', `/entities/${entityId}/data/${rowId}`),

  listEntityRelationships: () =>
    requestJson<EntityRelationshipDefinition[]>('GET', '/entity-relationships'),

  createEntityRelationship: (body: {
    relationship_name: string;
    subject_entity_id: number;
    object_entity_id: number;
  }) => requestJson<EntityRelationshipDefinition>('POST', '/entity-relationships', body),

  updateEntityRelationship: (
    entityRelationshipId: number,
    body: {
      relationship_name?: string;
      subject_entity_id?: number;
      object_entity_id?: number;
    },
  ) =>
    requestJson<EntityRelationshipDefinition>(
      'PUT',
      `/entity-relationships/${entityRelationshipId}`,
      body,
    ),

  deleteEntityRelationship: (entityRelationshipId: number) =>
    requestJson<{ ok: boolean }>('DELETE', `/entity-relationships/${entityRelationshipId}`),

  listRelationships: () => requestJson<RelationshipRecord[]>('GET', '/relationships'),

  createRelationship: (body: {
    relationship_name: string;
    subject_entity_id: number;
    object_entity_id: number;
    subject_row_id: number;
    object_row_id: number;
  }) => requestJson<RelationshipRecord>('POST', '/relationships', body),

  updateRelationship: (
    relationshipId: number,
    body: {
      relationship_name?: string;
      subject_entity_id?: number;
      object_entity_id?: number;
      subject_row_id?: number;
      object_row_id?: number;
    },
  ) => requestJson<RelationshipRecord>('PUT', `/relationships/${relationshipId}`, body),

  deleteRelationship: (relationshipId: number) =>
    requestJson<{ ok: boolean }>('DELETE', `/relationships/${relationshipId}`),

  exportTurtle: (body: TurtleExportRequest) => requestTurtle(body),

  listPolicyRoles: () => requestJson<PolicyRolesResponse>('GET', '/policy/roles'),
};
