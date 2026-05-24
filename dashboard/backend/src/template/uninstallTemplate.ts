import { dataLayerClient } from '../dataLayerClient.js';
import { deleteWorkflowRecord, listWorkflows } from '../workflow/database.js';
import { loadTemplateById } from './listTemplates.js';
import { isTemplateInstalled } from './templateInstallStatus.js';
import type { TemplateUninstallResult } from './types.js';

// Remove template workflows, entity relationships, and entities from the platform.
export async function uninstallTemplate(templateId: string): Promise<TemplateUninstallResult> {
  const template = loadTemplateById(templateId);
  const installed = await isTemplateInstalled(templateId);
  if (!installed) {
    throw new Error('Template is not installed');
  }

  const deletedWorkflows: TemplateUninstallResult['workflows'] = [];
  const workflows = listWorkflows();
  for (const workflowDefinition of template.workflows) {
    const match = workflows.find((row) => row.name === workflowDefinition.name);
    if (match) {
      deleteWorkflowRecord(match.id);
      deletedWorkflows.push({ name: workflowDefinition.name, workflowId: match.id });
    }
  }

  const deletedEntityRelationships: TemplateUninstallResult['entityRelationships'] = [];
  const entities = await dataLayerClient.listEntities();
  const entityIdByName = new Map(entities.map((row) => [row.name, row.id]));
  const entityRelationships = await dataLayerClient.listEntityRelationships();

  for (const relationshipDefinition of template.entity_relationships || []) {
    const subjectEntityId = entityIdByName.get(relationshipDefinition.subject_entity_name);
    const objectEntityId = entityIdByName.get(relationshipDefinition.object_entity_name);
    if (!subjectEntityId || !objectEntityId) {
      continue;
    }

    const match = entityRelationships.find(
      (row) =>
        row.relationship_name === relationshipDefinition.relationship_name &&
        row.subject_entity_id === subjectEntityId &&
        row.object_entity_id === objectEntityId,
    );
    if (match) {
      await dataLayerClient.deleteEntityRelationship(match.id);
      deletedEntityRelationships.push({
        ref: relationshipDefinition.ref,
        entityRelationshipId: match.id,
      });
    }
  }

  const deletedEntities: TemplateUninstallResult['entities'] = [];
  const entityNamesToDelete = template.entities.map((row) => row.name).reverse();
  for (const entityName of entityNamesToDelete) {
    const entityId = entityIdByName.get(entityName);
    if (!entityId) {
      continue;
    }
    await dataLayerClient.deleteEntity(entityId);
    deletedEntities.push({ name: entityName, entityId });
  }

  return {
    ok: true,
    templateId: template.id,
    templateName: template.name,
    entities: deletedEntities,
    entityRelationships: deletedEntityRelationships,
    workflows: deletedWorkflows,
  };
}
