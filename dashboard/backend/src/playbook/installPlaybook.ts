import { dataLayerClient } from '../dataLayerClient.js';
import { createWorkflowRecord, listWorkflows } from '../workflow/database.js';
import type { WorkflowGraph } from '../workflow/types.js';
import { loadPlaybookById } from './listPlaybooks.js';
import type {
  PlaybookDefinition,
  PlaybookInstallEntityRelationshipResult,
  PlaybookInstallEntityResult,
  PlaybookInstallResult,
  PlaybookInstallWorkflowResult,
} from './types.js';

// Install a playbook: create entities, entity relationships, and workflows in the platform.
export async function installPlaybook(playbookId: string): Promise<PlaybookInstallResult> {
  const playbook = loadPlaybookById(playbookId);
  const { entityIdByName, entityResults } = await ensurePlaybookEntities(playbook);
  const { entityRelationshipIdByRef, entityRelationshipResults } =
    await ensurePlaybookEntityRelationships(playbook, entityIdByName);
  const workflowResults = await ensurePlaybookWorkflows(
    playbook,
    entityIdByName,
    entityRelationshipIdByRef,
  );

  return {
    ok: true,
    playbookId: playbook.id,
    playbookName: playbook.name,
    entities: entityResults,
    entityRelationships: entityRelationshipResults,
    workflows: workflowResults,
  };
}

// Create or reuse entities defined in the playbook.
async function ensurePlaybookEntities(playbook: PlaybookDefinition): Promise<{
  entityIdByName: Map<string, number>;
  entityResults: PlaybookInstallEntityResult[];
}> {
  const existingEntities = await dataLayerClient.listEntities();
  const entityIdByName = new Map<string, number>();
  const entityResults: PlaybookInstallEntityResult[] = [];

  for (const existing of existingEntities) {
    entityIdByName.set(existing.name, existing.id);
  }

  for (const entityDefinition of playbook.entities) {
    const entityName = entityDefinition.name.trim();
    if (!entityName) {
      throw new Error('Playbook entity name is required');
    }

    const existingId = entityIdByName.get(entityName);
    if (existingId) {
      entityResults.push({
        name: entityName,
        entityId: existingId,
        created: false,
      });
      continue;
    }

    const createdEntity = await dataLayerClient.createEntity({
      name: entityName,
      display_name: entityDefinition.display_name || entityName,
      fields: entityDefinition.fields.map((field) => ({
        field_name: field.field_name,
        field_type: field.field_type,
        is_required: Boolean(field.is_required),
        description: field.description,
        example: field.example,
        extraction_hint: field.extraction_hint,
        is_identifier: Boolean(field.is_identifier),
      })),
    });

    entityIdByName.set(entityName, createdEntity.id);
    entityResults.push({
      name: entityName,
      entityId: createdEntity.id,
      created: true,
    });
  }

  return { entityIdByName, entityResults };
}

// Create or reuse schema relationships; return ref -> id map and audit rows.
async function ensurePlaybookEntityRelationships(
  playbook: PlaybookDefinition,
  entityIdByName: Map<string, number>,
): Promise<{
  entityRelationshipIdByRef: Map<string, number>;
  entityRelationshipResults: PlaybookInstallEntityRelationshipResult[];
}> {
  const relationshipDefinitions = playbook.entity_relationships || [];
  const existingRelationships = await dataLayerClient.listEntityRelationships();
  const entityRelationshipIdByRef = new Map<string, number>();
  const entityRelationshipResults: PlaybookInstallEntityRelationshipResult[] = [];

  for (const relationshipDefinition of relationshipDefinitions) {
    const subjectEntityId = entityIdByName.get(relationshipDefinition.subject_entity_name);
    const objectEntityId = entityIdByName.get(relationshipDefinition.object_entity_name);

    if (!subjectEntityId || !objectEntityId) {
      throw new Error(
        `Entity relationship ${relationshipDefinition.ref} references unknown entities`,
      );
    }

    const existingMatch = existingRelationships.find(
      (row) =>
        row.relationship_name === relationshipDefinition.relationship_name &&
        row.subject_entity_id === subjectEntityId &&
        row.object_entity_id === objectEntityId,
    );

    if (existingMatch) {
      entityRelationshipIdByRef.set(relationshipDefinition.ref, existingMatch.id);
      entityRelationshipResults.push({
        ref: relationshipDefinition.ref,
        entityRelationshipId: existingMatch.id,
        created: false,
      });
      continue;
    }

    const createdRelationship = await dataLayerClient.createEntityRelationship({
      relationship_name: relationshipDefinition.relationship_name,
      subject_entity_id: subjectEntityId,
      object_entity_id: objectEntityId,
    });

    existingRelationships.push(createdRelationship);
    entityRelationshipIdByRef.set(relationshipDefinition.ref, createdRelationship.id);
    entityRelationshipResults.push({
      ref: relationshipDefinition.ref,
      entityRelationshipId: createdRelationship.id,
      created: true,
    });
  }

  return { entityRelationshipIdByRef, entityRelationshipResults };
}

// Create workflows with resolved entity and relationship ids in the graph.
async function ensurePlaybookWorkflows(
  playbook: PlaybookDefinition,
  entityIdByName: Map<string, number>,
  entityRelationshipIdByRef: Map<string, number>,
): Promise<PlaybookInstallWorkflowResult[]> {
  const existingWorkflows = listWorkflows();
  const workflowResults: PlaybookInstallWorkflowResult[] = [];

  for (const workflowDefinition of playbook.workflows) {
    const workflowName = workflowDefinition.name.trim();
    if (!workflowName) {
      throw new Error('Playbook workflow name is required');
    }

    const existingWorkflow = existingWorkflows.find((row) => row.name === workflowName);
    if (existingWorkflow) {
      workflowResults.push({
        name: workflowName,
        workflowId: existingWorkflow.id,
        created: false,
      });
      continue;
    }

    const resolvedGraph = resolveWorkflowGraphReferences(
      workflowDefinition.graph,
      entityIdByName,
      entityRelationshipIdByRef,
    );

    const createdWorkflow = createWorkflowRecord({
      name: workflowName,
      description: workflowDefinition.description || '',
      graph: resolvedGraph,
    });

    existingWorkflows.push(createdWorkflow);
    workflowResults.push({
      name: workflowName,
      workflowId: createdWorkflow.id,
      created: true,
    });
  }

  return workflowResults;
}

// Replace entityRef / entityRelationshipRef placeholders with numeric ids.
function resolveWorkflowGraphReferences(
  graph: WorkflowGraph,
  entityIdByName: Map<string, number>,
  entityRelationshipIdByRef: Map<string, number>,
): WorkflowGraph {
  const resolvedNodes = graph.nodes.map((node) => {
    const nextData = { ...node.data };

    const entityRef = String(nextData.entityRef || '').trim();
    if (entityRef) {
      const entityId = entityIdByName.get(entityRef);
      if (!entityId) {
        throw new Error(`Workflow node ${node.id} references unknown entityRef: ${entityRef}`);
      }
      nextData.entityId = entityId;
      delete nextData.entityRef;
    }

    const entityRelationshipRef = String(nextData.entityRelationshipRef || '').trim();
    if (entityRelationshipRef) {
      const entityRelationshipId = entityRelationshipIdByRef.get(entityRelationshipRef);
      if (!entityRelationshipId) {
        throw new Error(
          `Workflow node ${node.id} references unknown entityRelationshipRef: ${entityRelationshipRef}`,
        );
      }
      nextData.entityRelationshipId = entityRelationshipId;
      delete nextData.entityRelationshipRef;
    }

    return {
      ...node,
      data: nextData,
    };
  });

  return {
    nodes: resolvedNodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}
