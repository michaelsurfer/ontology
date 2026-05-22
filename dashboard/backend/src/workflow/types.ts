export type WorkflowNodeType =
  | 'trigger'
  | 'field_mapper'
  | 'validate'
  | 'entities'
  | 'relationships'
  | 'fallback';

export type FieldValidationFormat =
  | 'required'
  | 'text'
  | 'number'
  | 'integer'
  | 'email'
  | 'date';

export type FieldValidationRule = {
  jsonField: string;
  format: FieldValidationFormat;
  minValue?: number | null;
  maxValue?: number | null;
};

export type ValidateNodeData = {
  label?: string;
  rules?: FieldValidationRule[];
};

export type FieldMappingRule = {
  sourceField: string;
  targetField: string;
  targetMode: 'custom' | 'entity';
};

export type FieldMapperNodeData = {
  label?: string;
  /** Entity used to pick target field names in the editor. */
  entityId?: number | null;
  mappings?: FieldMappingRule[];
};

export type WorkflowGraphNode = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowGraphEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

export type TriggerNodeData = {
  label?: string;
  triggerType?: 'manual' | 'webhook';
};

export type EntitiesNodeData = {
  label?: string;
  /** Single entity chosen for this node (preferred). */
  entityId?: number | null;
  /** @deprecated Use entityId — kept for older saved workflows. */
  entityIds?: number[];
  minMatchScore?: number;
};

export type RelationshipsNodeData = {
  label?: string;
  /** Required — id from GET /entity-relationships. */
  entityRelationshipId?: number | null;
  /** Incoming JSON key whose value identifies the object row (e.g. company_name). */
  payloadLinkField?: string;
  /** Field on the object (target) entity to match against (e.g. name). */
  objectEntityField?: string;
};

export type FallbackNodeData = {
  label?: string;
  /** send to landing zone (persist for review) or stop (report only). */
  action?: 'landing_zone' | 'stop';
};

export type WorkflowRecord = {
  id: number;
  name: string;
  description: string;
  graph_json: string;
  created_at_ms: number;
  updated_at_ms: number;
};

export type WorkflowRunRecord = {
  id: number;
  workflow_id: number;
  status: string;
  dry_run: number;
  input_json: string;
  result_json: string;
  started_at_ms: number;
  finished_at_ms: number | null;
};

export type EntityMappingResult = {
  recordIndex: number;
  entityId: number;
  entityName: string;
  rowId?: number;
  ok: boolean;
  reason?: string;
  matchScore?: number;
  dryRun?: boolean;
};

export type RelationshipMappingResult = {
  recordIndex: number;
  relationshipName: string;
  subjectEntityId: number;
  objectEntityId: number;
  subjectRowId: number;
  objectRowId: number;
  ok: boolean;
  reason?: string;
  relationshipId?: number;
  dryRun?: boolean;
};

export type ValidationRecordResult = {
  recordIndex: number;
  ok: boolean;
  failures: Array<{ field: string; message: string }>;
  dryRun?: boolean;
};

export type FallbackRecordResult = {
  recordIndex: number;
  reason: string;
  payload: Record<string, unknown>;
};

export type WorkflowExecutionResult = {
  ok: boolean;
  dryRun: boolean;
  recordsProcessed: number;
  entitiesInserted: number;
  relationshipsCreated: number;
  validationFailedCount: number;
  fallbackCount: number;
  entityResults: EntityMappingResult[];
  relationshipResults: RelationshipMappingResult[];
  validationResults: ValidationRecordResult[];
  fallbackRecords: FallbackRecordResult[];
  nodeLogs: Array<{ nodeId: string; nodeType: WorkflowNodeType; message: string }>;
};

export type RecordEntityRows = Record<
  number,
  Record<string, { entityId: number; entityName: string; rowId: number; values: Record<string, unknown> }>
>;
