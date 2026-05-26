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
  installed: boolean;
  primaryWorkflowId?: number | null;
  primaryWorkflowName?: string | null;
  primaryEntityId?: number | null;
  primaryEntityName?: string | null;
  entities?: PlaybookInstalledEntityLink[];
  entityRelationships?: PlaybookInstalledEntityRelationshipLink[];
  workflows?: PlaybookInstalledWorkflowLink[];
  publicWebhookPath?: string | null;
};
