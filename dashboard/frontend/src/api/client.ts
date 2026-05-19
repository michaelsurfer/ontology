import axios from 'axios';
import type {
  EntityDefinition,
  EntityRelationshipDefinition,
  EntityRowRecord,
  EntitySummary,
  GraphViewModel,
  RelationshipRecord,
} from '../types';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
});

export const ontologyApi = {
  health: () => apiClient.get('/health'),

  listEntities: () => apiClient.get<EntitySummary[]>('/entities'),

  getEntity: (entityId: number) => apiClient.get<EntityDefinition>(`/entities/${entityId}`),

  createEntity: (body: {
    name: string;
    display_name?: string;
    fields: Array<{ field_name: string; field_type: string; is_required?: boolean }>;
  }) => apiClient.post<EntityDefinition>('/entities', body),

  updateEntity: (
    entityId: number,
    body: {
      name?: string;
      display_name?: string;
      fields?: Array<{ field_name: string; field_type: string; is_required?: boolean }>;
    },
  ) => apiClient.put<EntityDefinition>(`/entities/${entityId}`, body),

  deleteEntity: (entityId: number) => apiClient.delete(`/entities/${entityId}`),

  listEntityRows: (entityId: number) => apiClient.get<EntityRowRecord[]>(`/entities/${entityId}/data`),

  createEntityRow: (entityId: number, values: Record<string, unknown>) =>
    apiClient.post<EntityRowRecord>(`/entities/${entityId}/data`, { values }),

  updateEntityRow: (entityId: number, rowId: number, values: Record<string, unknown>) =>
    apiClient.put<EntityRowRecord>(`/entities/${entityId}/data/${rowId}`, { values }),

  deleteEntityRow: (entityId: number, rowId: number) =>
    apiClient.delete(`/entities/${entityId}/data/${rowId}`),

  listEntityRelationships: () => apiClient.get<EntityRelationshipDefinition[]>('/entity-relationships'),

  createEntityRelationship: (body: {
    relationship_name: string;
    subject_entity_id: number;
    object_entity_id: number;
  }) => apiClient.post<EntityRelationshipDefinition>('/entity-relationships', body),

  updateEntityRelationship: (
    entityRelationshipId: number,
    body: {
      relationship_name?: string;
      subject_entity_id?: number;
      object_entity_id?: number;
    },
  ) => apiClient.put<EntityRelationshipDefinition>(`/entity-relationships/${entityRelationshipId}`, body),

  deleteEntityRelationship: (entityRelationshipId: number) =>
    apiClient.delete(`/entity-relationships/${entityRelationshipId}`),

  listRelationships: () => apiClient.get<RelationshipRecord[]>('/relationships'),

  createRelationship: (body: {
    relationship_name: string;
    subject_entity_id: number;
    object_entity_id: number;
    subject_row_id: number;
    object_row_id: number;
  }) => apiClient.post<RelationshipRecord>('/relationships', body),

  updateRelationship: (
    relationshipId: number,
    body: {
      relationship_name?: string;
      subject_entity_id?: number;
      object_entity_id?: number;
      subject_row_id?: number;
      object_row_id?: number;
    },
  ) => apiClient.put<RelationshipRecord>(`/relationships/${relationshipId}`, body),

  deleteRelationship: (relationshipId: number) => apiClient.delete(`/relationships/${relationshipId}`),

  fetchRdfGraph: (body: { entity_ids?: '*' | number[]; entity_names?: string[] }) =>
    apiClient.post<GraphViewModel>('/rdf/graph', body),

  fetchTurtle: (body: { entity_ids?: '*' | number[]; entity_names?: string[] }) =>
    apiClient.post<string>('/rdf/turtle', body, { responseType: 'text' }),

  syncRdfCache: (body: { entity_ids?: '*' | number[]; entity_names?: string[] } = { entity_ids: '*' }) =>
    apiClient.post<{
      ok: boolean;
      dataLayerUrl: string;
      rdfCacheUrl: string;
      version: number;
      turtle_bytes: number;
      updated_at_ms: number;
    }>('/rdf/sync-cache', body),
};
