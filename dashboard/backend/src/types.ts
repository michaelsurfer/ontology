export type FieldType = 'TEXT' | 'INTEGER' | 'REAL';

export interface EntityFieldDefinition {
  id: number;
  field_name: string;
  field_type: FieldType;
  is_required: boolean;
  is_active: boolean;
  description: string;
  example: string;
  extraction_hint: string;
  is_identifier: boolean;
}

export interface EntityDefinition {
  id: number;
  name: string;
  display_name: string;
  fields: EntityFieldDefinition[];
  created_at_ms: number;
}

export interface EntitySummary {
  id: number;
  name: string;
}

export interface EntityRowRecord {
  id: number;
  entity_id: number;
  values: Record<string, unknown>;
  created_at_ms: number;
}

export interface EntityRelationshipDefinition {
  id: number;
  relationship_name: string;
  subject_entity_id: number;
  object_entity_id: number;
  created_at_ms: number;
}

export interface RelationshipRecord {
  id: number;
  relationship_name: string;
  subject_entity_id: number;
  object_entity_id: number;
  subject_row_id: number;
  object_row_id: number;
  created_at_ms: number;
}

export interface TurtleExportRequest {
  entity_ids?: '*' | number[];
  entity_names?: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'class' | 'instance' | 'property';
  entityId?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphViewModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
