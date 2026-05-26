import { dataLayerClient } from '../dataLayerClient.js';
import { deleteWorkflowRecord, listWorkflows } from '../workflow/database.js';
import { loadPlaybookById } from './listPlaybooks.js';
import { isPlaybookInstalled } from './playbookInstallStatus.js';
import type { PlaybookUninstallResult } from './types.js';

// Remove playbook workflows, entity relationships, and entities from the platform.
export async function uninstallPlaybook(playbookId: string): Promise<PlaybookUninstallResult> {
  const playbook = loadPlaybookById(playbookId);
  const installed = await isPlaybookInstalled(playbookId);
  if (!installed) {
    throw new Error('Playbook is not installed');
  }

  const deletedWorkflows: PlaybookUninstallResult['workflows'] = [];
  const workflows = listWorkflows();
  for (const workflowDefinition of playbook.workflows) {
    const match = workflows.find((row) => row.name === workflowDefinition.name);
    if (match) {
      deleteWorkflowRecord(match.id);
      deletedWorkflows.push({ name: workflowDefinition.name, workflowId: match.id });
    }
  }

  const deletedEntityRelationships: PlaybookUninstallResult['entityRelationships'] = [];
  const entities = await dataLayerClient.listEntities();
  const entityIdByName = new Map(entities.map((row) => [row.name, row.id]));
  const entityRelationships = await dataLayerClient.listEntityRelationships();

  for (const relationshipDefinition of playbook.entity_relationships || []) {
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

  const deletedEntities: PlaybookUninstallResult['entities'] = [];
  const entityNamesToDelete = playbook.entities.map((row) => row.name).reverse();
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
    playbookId: playbook.id,
    playbookName: playbook.name,
    entities: deletedEntities,
    entityRelationships: deletedEntityRelationships,
    workflows: deletedWorkflows,
  };
}
