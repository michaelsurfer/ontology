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
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

export type WorkflowSummary = {
  id: number;
  name: string;
  description: string;
  graph_json: string;
  created_at_ms: number;
  updated_at_ms: number;
};

export type WorkflowDetail = WorkflowSummary & {
  graph: WorkflowGraph;
};

export type WorkflowExecutionResult = {
  ok: boolean;
  dryRun: boolean;
  recordsProcessed: number;
  entitiesInserted: number;
  relationshipsCreated: number;
  validationFailedCount?: number;
  fallbackCount: number;
  entityResults: unknown[];
  relationshipResults: unknown[];
  validationResults?: unknown[];
  fallbackRecords: unknown[];
  nodeLogs: Array<{ nodeId: string; nodeType: string; message: string }>;
};

export type WorkflowRunSummary = {
  id: number;
  workflow_id: number;
  status: string;
  dry_run: boolean;
  started_at_ms: number;
  finished_at_ms: number | null;
  result: WorkflowExecutionResult;
};
