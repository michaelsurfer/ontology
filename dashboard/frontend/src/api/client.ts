import axios from 'axios';
import type {
  EntityDefinition,
  EntityRelationshipDefinition,
  EntityRowRecord,
  EntitySummary,
  GraphViewModel,
  RelationshipRecord,
} from '../types';
import type {
  WorkflowDetail,
  WorkflowExecutionResult,
  WorkflowGraph,
  WorkflowRunSummary,
  WorkflowSummary,
} from '../types/workflow';

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

  fetchRdfCacheMeta: () =>
    apiClient.get<{
      ok: boolean;
      rdfCacheUrl: string;
      version: number;
      turtle_bytes: number;
      updated_at_ms: number;
    }>('/rdf/cache-meta'),

  syncRdfCache: (body: { entity_ids?: '*' | number[]; entity_names?: string[] } = { entity_ids: '*' }) =>
    apiClient.post<{
      ok: boolean;
      dataLayerUrl: string;
      rdfCacheUrl: string;
      version: number;
      turtle_bytes: number;
      updated_at_ms: number;
    }>('/rdf/sync-cache', body),

  listWorkflows: () => apiClient.get<WorkflowSummary[]>('/workflows'),

  getWorkflow: (workflowId: number) => apiClient.get<WorkflowDetail>(`/workflows/${workflowId}`),

  createWorkflow: (body: { name: string; graph: WorkflowGraph }) =>
    apiClient.post<WorkflowDetail>('/workflows', body),

  updateWorkflow: (
    workflowId: number,
    body: { name: string; graph: WorkflowGraph },
  ) => apiClient.put<WorkflowDetail>(`/workflows/${workflowId}`, body),

  deleteWorkflow: (workflowId: number) => apiClient.delete(`/workflows/${workflowId}`),

  runWorkflow: (workflowId: number, body: { input: unknown; dry_run?: boolean }) =>
    apiClient.post<{
      run_id: number;
      workflow_id: number;
      status: string;
      dry_run: boolean;
      result: WorkflowExecutionResult;
    }>(`/workflows/${workflowId}/run`, body),

  listWorkflowRuns: (workflowId: number) =>
    apiClient.get<WorkflowRunSummary[]>(`/workflows/${workflowId}/runs`),

  listLandingZoneRecords: () =>
    apiClient.get<
      Array<{
        id: number;
        workflow_id: number | null;
        workflow_name: string;
        run_id: number | null;
        record_index: number;
        reason: string;
        payload: Record<string, unknown>;
        created_at_ms: number;
      }>
    >('/landing-zone'),

  deleteLandingZoneRecord: (recordId: number) => apiClient.delete(`/landing-zone/${recordId}`),
};
