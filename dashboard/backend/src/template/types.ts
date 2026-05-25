import type { WorkflowGraph } from '../workflow/types.js';

export type TemplateFieldDefinition = {
  field_name: string;
  field_type: 'TEXT' | 'INTEGER' | 'REAL' | string;
  is_required?: boolean;
  description?: string;
  example?: string;
  extraction_hint?: string;
  is_identifier?: boolean;
};

export type TemplateEntityDefinition = {
  name: string;
  display_name?: string;
  fields: TemplateFieldDefinition[];
};

export type TemplateEntityRelationshipDefinition = {
  /** Stable key referenced by workflow graph nodes (entityRelationshipRef). */
  ref: string;
  relationship_name: string;
  subject_entity_name: string;
  object_entity_name: string;
};

export type TemplateWorkflowDefinition = {
  name: string;
  description?: string;
  graph: WorkflowGraph;
};

/** Full template payload stored as JSON under src/template/templates/. */
export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  /** User-facing steps shown under Instruction in the Templates UI. */
  instructions?: string;
  entities: TemplateEntityDefinition[];
  entity_relationships?: TemplateEntityRelationshipDefinition[];
  workflows: TemplateWorkflowDefinition[];
};

export type TemplateInstalledEntityLink = {
  name: string;
  display_name: string;
  entity_id: number;
};

export type TemplateInstalledEntityRelationshipLink = {
  ref: string;
  relationship_name: string;
  subject_entity_name: string;
  object_entity_name: string;
  subject_display_name: string;
  object_display_name: string;
  entity_relationship_id: number;
};

export type TemplateInstalledWorkflowLink = {
  name: string;
  description?: string;
  workflow_id: number;
};

export type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  /** All template entities, relationships, and workflows exist in the platform. */
  installed?: boolean;
  /** Set when installed — primary ingest workflow for webhook links. */
  primaryWorkflowId?: number | null;
  primaryWorkflowName?: string | null;
  primaryEntityId?: number | null;
  primaryEntityName?: string | null;
  entities?: TemplateInstalledEntityLink[];
  entityRelationships?: TemplateInstalledEntityRelationshipLink[];
  workflows?: TemplateInstalledWorkflowLink[];
  publicWebhookPath?: string | null;
};

export type TemplateInstallEntityResult = {
  name: string;
  entityId: number;
  created: boolean;
};

export type TemplateInstallEntityRelationshipResult = {
  ref: string;
  entityRelationshipId: number;
  created: boolean;
};

export type TemplateInstallWorkflowResult = {
  name: string;
  workflowId: number;
  created: boolean;
};

export type TemplateInstallResult = {
  ok: true;
  templateId: string;
  templateName: string;
  entities: TemplateInstallEntityResult[];
  entityRelationships: TemplateInstallEntityRelationshipResult[];
  workflows: TemplateInstallWorkflowResult[];
};

export type TemplateUninstallResult = {
  ok: true;
  templateId: string;
  templateName: string;
  entities: Array<{ name: string; entityId: number }>;
  entityRelationships: Array<{ ref: string; entityRelationshipId: number }>;
  workflows: Array<{ name: string; workflowId: number }>;
};
