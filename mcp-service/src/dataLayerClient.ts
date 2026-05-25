import { getDataLayerBaseUrl } from './config.js';
import { requestJson, requestTurtle } from './httpJson.js';

export type EntitySummary = { id: number; name: string };

export type EntityField = {
  field_name: string;
  field_type: string;
  is_required?: boolean;
  description?: string;
  example?: string;
  extraction_hint?: string;
  is_identifier?: boolean;
};

export type EntityFieldDefinition = EntityField & {
  id: number;
  is_active: boolean;
};

export type EntityDefinition = {
  id: number;
  name: string;
  display_name: string;
  fields: EntityFieldDefinition[];
  created_at_ms: number;
};

export type EntityRowRecord = {
  id: number;
  entity_id: number;
  values: Record<string, unknown>;
  created_at_ms: number;
};

export type EntityRelationshipDefinition = {
  id: number;
  relationship_name: string;
  subject_entity_id: number;
  object_entity_id: number;
  created_at_ms: number;
};

export type RelationshipRecord = {
  id: number;
  relationship_name: string;
  subject_entity_id: number;
  object_entity_id: number;
  subject_row_id: number;
  object_row_id: number;
  created_at_ms: number;
};

export type TurtleExportRequest = {
  entity_ids?: '*' | number[];
  entity_names?: string[];
};

export type CreateEntityBody = {
  name: string;
  display_name?: string;
  fields: EntityField[];
};

export type UpdateEntityBody = {
  name?: string;
  display_name?: string;
  fields?: EntityField[];
};

function baseUrl(): string {
  return getDataLayerBaseUrl();
}

export const dataLayerClient = {
  health: () => requestJson<{ ok: boolean }>(baseUrl(), 'GET', '/health'),

  listEntities: () => requestJson<EntitySummary[]>(baseUrl(), 'GET', '/entities'),

  getEntity: (entityId: number) =>
    requestJson<EntityDefinition>(baseUrl(), 'GET', `/entities/${entityId}`),

  createEntity: (body: CreateEntityBody) =>
    requestJson<EntityDefinition>(baseUrl(), 'POST', '/entities', body),

  updateEntity: (entityId: number, body: UpdateEntityBody) =>
    requestJson<EntityDefinition>(baseUrl(), 'PUT', `/entities/${entityId}`, body),

  deleteEntity: (entityId: number) =>
    requestJson<{ ok: boolean }>(baseUrl(), 'DELETE', `/entities/${entityId}`),

  listEntityRows: (entityId: number) =>
    requestJson<EntityRowRecord[]>(baseUrl(), 'GET', `/entities/${entityId}/data`),

  createEntityRow: (entityId: number, values: Record<string, unknown>) =>
    requestJson<EntityRowRecord>(baseUrl(), 'POST', `/entities/${entityId}/data`, { values }),

  updateEntityRow: (entityId: number, rowId: number, values: Record<string, unknown>) =>
    requestJson<EntityRowRecord>(baseUrl(), 'PUT', `/entities/${entityId}/data/${rowId}`, {
      values,
    }),

  deleteEntityRow: (entityId: number, rowId: number) =>
    requestJson<{ ok: boolean }>(baseUrl(), 'DELETE', `/entities/${entityId}/data/${rowId}`),

  listEntityRelationships: () =>
    requestJson<EntityRelationshipDefinition[]>(baseUrl(), 'GET', '/entity-relationships'),

  getEntityRelationship: (entityRelationshipId: number) =>
    requestJson<EntityRelationshipDefinition>(
      baseUrl(),
      'GET',
      `/entity-relationships/${entityRelationshipId}`,
    ),

  createEntityRelationship: (body: {
    relationship_name: string;
    subject_entity_id: number;
    object_entity_id: number;
  }) => requestJson<EntityRelationshipDefinition>(baseUrl(), 'POST', '/entity-relationships', body),

  updateEntityRelationship: (
    entityRelationshipId: number,
    body: {
      relationship_name?: string;
      subject_entity_id?: number;
      object_entity_id?: number;
    },
  ) =>
    requestJson<EntityRelationshipDefinition>(
      baseUrl(),
      'PUT',
      `/entity-relationships/${entityRelationshipId}`,
      body,
    ),

  deleteEntityRelationship: (entityRelationshipId: number) =>
    requestJson<{ ok: boolean }>(baseUrl(), 'DELETE', `/entity-relationships/${entityRelationshipId}`),

  listRelationships: () => requestJson<RelationshipRecord[]>(baseUrl(), 'GET', '/relationships'),

  createRelationship: (body: {
    relationship_name: string;
    subject_entity_id: number;
    object_entity_id: number;
    subject_row_id: number;
    object_row_id: number;
  }) => requestJson<RelationshipRecord>(baseUrl(), 'POST', '/relationships', body),

  updateRelationship: (
    relationshipId: number,
    body: {
      relationship_name?: string;
      subject_entity_id?: number;
      object_entity_id?: number;
      subject_row_id?: number;
      object_row_id?: number;
    },
  ) => requestJson<RelationshipRecord>(baseUrl(), 'PUT', `/relationships/${relationshipId}`, body),

  deleteRelationship: (relationshipId: number) =>
    requestJson<{ ok: boolean }>(baseUrl(), 'DELETE', `/relationships/${relationshipId}`),

  exportTurtle: (body: TurtleExportRequest) => requestTurtle(baseUrl(), body),
};
