import { dataLayerClient } from '../dataLayerClient.js';
import { listWorkflows } from '../workflow/database.js';
import { loadTemplateById, listTemplateSummaries } from './listTemplates.js';
import { buildTemplatePublicPaths } from './buildTemplateLinks.js';
import {
  resolvePrimaryEntityIdForTemplate,
  resolvePrimaryWorkflowName,
} from './templateResolver.js';
import type { TemplateDefinition, TemplateSummary } from './types.js';

// True when every entity, entity relationship, and workflow from the template already exists.
export async function isTemplateInstalled(templateId: string): Promise<boolean> {
  const template = loadTemplateById(templateId);
  const [entities, entityRelationships, workflows] = await Promise.all([
    dataLayerClient.listEntities(),
    dataLayerClient.listEntityRelationships(),
    Promise.resolve(listWorkflows()),
  ]);

  const entityNameSet = new Set(entities.map((row) => row.name));
  for (const entityDefinition of template.entities) {
    if (!entityNameSet.has(entityDefinition.name)) {
      return false;
    }
  }

  const entityIdByName = new Map(entities.map((row) => [row.name, row.id]));
  for (const relationshipDefinition of template.entity_relationships || []) {
    const subjectEntityId = entityIdByName.get(relationshipDefinition.subject_entity_name);
    const objectEntityId = entityIdByName.get(relationshipDefinition.object_entity_name);
    if (!subjectEntityId || !objectEntityId) {
      return false;
    }

    const relationshipExists = entityRelationships.some(
      (row) =>
        row.relationship_name === relationshipDefinition.relationship_name &&
        row.subject_entity_id === subjectEntityId &&
        row.object_entity_id === objectEntityId,
    );
    if (!relationshipExists) {
      return false;
    }
  }

  const workflowNameSet = new Set(workflows.map((row) => row.name));
  for (const workflowDefinition of template.workflows) {
    if (!workflowNameSet.has(workflowDefinition.name)) {
      return false;
    }
  }

  return true;
}

// List templates with installed flag based on current data-layer and workflow state.
export async function listTemplateSummariesWithStatus(): Promise<
  Array<TemplateSummary & { installed: boolean }>
> {
  const summaries = listTemplateSummaries();
  const statusRows: Array<TemplateSummary & { installed: boolean }> = [];

  const workflows = listWorkflows();

  const platformEntities = await dataLayerClient.listEntities();

  for (const summary of summaries) {
    let installed = false;
    let primaryWorkflowId: number | null = null;
    let primaryWorkflowName: string | null = null;
    let primaryEntityId: number | null = null;
    let primaryEntityName: string | null = null;
    let entities: TemplateSummary['entities'];
    let publicWebhookPath: string | null = null;
    let publicDocumentUploadPath: string | null = null;
    let instructions: string | undefined;

    try {
      const template = loadTemplateById(summary.id);
      instructions = template.instructions;
      installed = await isTemplateInstalled(summary.id);
      if (installed) {
        primaryWorkflowName = resolvePrimaryWorkflowName(template);
        const workflowMatch = workflows.find((row) => row.name === primaryWorkflowName);
        primaryWorkflowId = workflowMatch?.id ?? null;

        if (primaryWorkflowId) {
          const publicPaths = buildTemplatePublicPaths(summary.id, primaryWorkflowId);
          publicWebhookPath = publicPaths.publicWebhookPath;
          publicDocumentUploadPath = publicPaths.publicDocumentUploadPath;
          primaryEntityId = await resolvePrimaryEntityIdForTemplate(summary.id, primaryWorkflowId);
        }

        entities = template.entities.map((entityDefinition) => {
          const entityRow = platformEntities.find((row) => row.name === entityDefinition.name);
          return {
            name: entityDefinition.name,
            display_name: entityDefinition.display_name || entityDefinition.name,
            entity_id: entityRow?.id ?? 0,
          };
        }).filter((row) => row.entity_id > 0);

        if (primaryEntityId) {
          const primaryEntity = entities.find((row) => row.entity_id === primaryEntityId);
          primaryEntityName = primaryEntity?.display_name ?? primaryEntity?.name ?? null;
        }
      }
    } catch {
      installed = false;
    }

    statusRows.push({
      ...summary,
      instructions,
      installed,
      primaryWorkflowId,
      primaryWorkflowName,
      primaryEntityId,
      primaryEntityName,
      entities,
      publicWebhookPath,
      publicDocumentUploadPath,
    });
  }

  return statusRows;
}

// Build install status details for one template (for debugging or future UI).
export async function describeTemplateInstallStatus(templateId: string): Promise<{
  installed: boolean;
  missingEntities: string[];
  missingEntityRelationships: string[];
  missingWorkflows: string[];
}> {
  const template = loadTemplateById(templateId);
  const missingEntities = await findMissingEntityNames(template);
  const missingEntityRelationships = await findMissingEntityRelationshipRefs(template);
  const missingWorkflows = await findMissingWorkflowNames(template);

  return {
    installed:
      missingEntities.length === 0 &&
      missingEntityRelationships.length === 0 &&
      missingWorkflows.length === 0,
    missingEntities,
    missingEntityRelationships,
    missingWorkflows,
  };
}

async function findMissingEntityNames(template: TemplateDefinition): Promise<string[]> {
  const entities = await dataLayerClient.listEntities();
  const entityNameSet = new Set(entities.map((row) => row.name));
  return template.entities
    .map((entityDefinition) => entityDefinition.name)
    .filter((entityName) => !entityNameSet.has(entityName));
}

async function findMissingEntityRelationshipRefs(template: TemplateDefinition): Promise<string[]> {
  const entities = await dataLayerClient.listEntities();
  const entityRelationships = await dataLayerClient.listEntityRelationships();
  const entityIdByName = new Map(entities.map((row) => [row.name, row.id]));
  const missingRefs: string[] = [];

  for (const relationshipDefinition of template.entity_relationships || []) {
    const subjectEntityId = entityIdByName.get(relationshipDefinition.subject_entity_name);
    const objectEntityId = entityIdByName.get(relationshipDefinition.object_entity_name);
    if (!subjectEntityId || !objectEntityId) {
      missingRefs.push(relationshipDefinition.ref);
      continue;
    }

    const relationshipExists = entityRelationships.some(
      (row) =>
        row.relationship_name === relationshipDefinition.relationship_name &&
        row.subject_entity_id === subjectEntityId &&
        row.object_entity_id === objectEntityId,
    );
    if (!relationshipExists) {
      missingRefs.push(relationshipDefinition.ref);
    }
  }

  return missingRefs;
}

async function findMissingWorkflowNames(template: TemplateDefinition): Promise<string[]> {
  const workflows = listWorkflows();
  const workflowNameSet = new Set(workflows.map((row) => row.name));
  return template.workflows
    .map((workflowDefinition) => workflowDefinition.name)
    .filter((workflowName) => !workflowNameSet.has(workflowName));
}
