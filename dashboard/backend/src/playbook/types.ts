import type { WorkflowGraph } from '../workflow/types.js';

export type PlaybookFieldDefinition = {
  field_name: string;
  field_type: 'TEXT' | 'INTEGER' | 'REAL' | string;
  is_required?: boolean;
  description?: string;
  example?: string;
  extraction_hint?: string;
  is_identifier?: boolean;
};

export type PlaybookEntityDefinition = {
  name: string;
  display_name?: string;
  fields: PlaybookFieldDefinition[];
};

export type PlaybookEntityRelationshipDefinition = {
  /** Stable key referenced by workflow graph nodes (entityRelationshipRef). */
  ref: string;
  relationship_name: string;
  subject_entity_name: string;
  object_entity_name: string;
};

export type PlaybookWorkflowDefinition = {
  name: string;
  description?: string;
  graph: WorkflowGraph;
};

/** Full playbook payload stored as JSON under src/playbook/playbooks/. */
export type PlaybookDefinition = {
  id: string;
  name: string;
  description: string;
  /** User-facing steps shown under Instruction in the Playbooks UI. */
  instructions?: string;
  entities: PlaybookEntityDefinition[];
  entity_relationships?: PlaybookEntityRelationshipDefinition[];
  workflows: PlaybookWorkflowDefinition[];
};

export type PlaybookInstalledEntityLink = {
  name: string;
  display_name: string;
  entity_id: number;
};

export type PlaybookInstalledEntityRelationshipLink = {
  ref: string;
  relationship_name: string;
  subject_entity_name: string;
  object_entity_name: string;
  subject_display_name: string;
  object_display_name: string;
  entity_relationship_id: number;
};

export type PlaybookInstalledWorkflowLink = {
  name: string;
  description?: string;
  workflow_id: number;
};

export type PlaybookSummary = {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  /** All playbook entities, relationships, and workflows exist in the platform. */
  installed?: boolean;
  /** Set when installed — primary ingest workflow for webhook links. */
  primaryWorkflowId?: number | null;
  primaryWorkflowName?: string | null;
  primaryEntityId?: number | null;
  primaryEntityName?: string | null;
  entities?: PlaybookInstalledEntityLink[];
  entityRelationships?: PlaybookInstalledEntityRelationshipLink[];
  workflows?: PlaybookInstalledWorkflowLink[];
  publicWebhookPath?: string | null;
};

export type PlaybookInstallEntityResult = {
  name: string;
  entityId: number;
  created: boolean;
};

export type PlaybookInstallEntityRelationshipResult = {
  ref: string;
  entityRelationshipId: number;
  created: boolean;
};

export type PlaybookInstallWorkflowResult = {
  name: string;
  workflowId: number;
  created: boolean;
};

export type PlaybookInstallResult = {
  ok: true;
  playbookId: string;
  playbookName: string;
  entities: PlaybookInstallEntityResult[];
  entityRelationships: PlaybookInstallEntityRelationshipResult[];
  workflows: PlaybookInstallWorkflowResult[];
};

export type PlaybookUninstallResult = {
  ok: true;
  playbookId: string;
  playbookName: string;
  entities: Array<{ name: string; entityId: number }>;
  entityRelationships: Array<{ ref: string; entityRelationshipId: number }>;
  workflows: Array<{ name: string; workflowId: number }>;
};
