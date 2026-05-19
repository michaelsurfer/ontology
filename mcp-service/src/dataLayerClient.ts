import { getDataLayerBaseUrl } from './config.js';
import { requestJson, requestTurtle } from './httpJson.js';

export type EntitySummary = { id: number; name: string };

export type EntityField = {
  field_name: string;
  field_type: string;
  is_required?: boolean;
};

export type EntityDefinition = {
  id: number;
  name: string;
  display_name?: string;
  fields: EntityField[];
};

export type EntityRowRecord = {
  id: number;
  entity_id: number;
  values: Record<string, unknown>;
};

export type EntityRelationshipDefinition = {
  id: number;
  relationship_name: string;
  subject_entity_id: number;
  object_entity_id: number;
};

export type RelationshipRecord = {
  id: number;
  relationship_name: string;
  subject_entity_id: number;
  object_entity_id: number;
  subject_row_id: number;
  object_row_id: number;
};

export type TurtleExportRequest = {
  entity_ids?: '*' | number[];
  entity_names?: string[];
};

function baseUrl(): string {
  return getDataLayerBaseUrl();
}

export const dataLayerClient = {
  health: () => requestJson<{ ok: boolean }>(baseUrl(), 'GET', '/health'),

  listEntities: () => requestJson<EntitySummary[]>(baseUrl(), 'GET', '/entities'),

  getEntity: (entityId: number) =>
    requestJson<EntityDefinition>(baseUrl(), 'GET', `/entities/${entityId}`),

  listEntityRows: (entityId: number) =>
    requestJson<EntityRowRecord[]>(baseUrl(), 'GET', `/entities/${entityId}/data`),

  createEntityRow: (entityId: number, values: Record<string, unknown>) =>
    requestJson<EntityRowRecord>(baseUrl(), 'POST', `/entities/${entityId}/data`, { values }),

  listEntityRelationships: () =>
    requestJson<EntityRelationshipDefinition[]>(baseUrl(), 'GET', '/entity-relationships'),

  listRelationships: () => requestJson<RelationshipRecord[]>(baseUrl(), 'GET', '/relationships'),

  exportTurtle: (body: TurtleExportRequest) => requestTurtle(baseUrl(), body),
};
