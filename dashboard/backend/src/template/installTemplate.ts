import { dataLayerClient } from '../dataLayerClient.js';
import { createWorkflowRecord, listWorkflows } from '../workflow/database.js';
import type { WorkflowGraph } from '../workflow/types.js';
import { loadTemplateById } from './listTemplates.js';
import type {
  TemplateDefinition,
  TemplateInstallEntityRelationshipResult,
  TemplateInstallEntityResult,
  TemplateInstallResult,
  TemplateInstallWorkflowResult,
} from './types.js';

// Install a template: create entities, entity relationships, and workflows in the platform.
export async function installTemplate(templateId: string): Promise<TemplateInstallResult> {
  const template = loadTemplateById(templateId);
  const { entityIdByName, entityResults } = await ensureTemplateEntities(template);
  const { entityRelationshipIdByRef, entityRelationshipResults } =
    await ensureTemplateEntityRelationships(template, entityIdByName);
  const workflowResults = await ensureTemplateWorkflows(
    template,
    entityIdByName,
    entityRelationshipIdByRef,
  );

  return {
    ok: true,
    templateId: template.id,
    templateName: template.name,
    entities: entityResults,
    entityRelationships: entityRelationshipResults,
    workflows: workflowResults,
  };
}

// Create or reuse entities defined in the template.
async function ensureTemplateEntities(template: TemplateDefinition): Promise<{
  entityIdByName: Map<string, number>;
  entityResults: TemplateInstallEntityResult[];
}> {
  const existingEntities = await dataLayerClient.listEntities();
  const entityIdByName = new Map<string, number>();
  const entityResults: TemplateInstallEntityResult[] = [];

  for (const existing of existingEntities) {
    entityIdByName.set(existing.name, existing.id);
  }

  for (const entityDefinition of template.entities) {
    const entityName = entityDefinition.name.trim();
    if (!entityName) {
      throw new Error('Template entity name is required');
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
async function ensureTemplateEntityRelationships(
  template: TemplateDefinition,
  entityIdByName: Map<string, number>,
): Promise<{
  entityRelationshipIdByRef: Map<string, number>;
  entityRelationshipResults: TemplateInstallEntityRelationshipResult[];
}> {
  const relationshipDefinitions = template.entity_relationships || [];
  const existingRelationships = await dataLayerClient.listEntityRelationships();
  const entityRelationshipIdByRef = new Map<string, number>();
  const entityRelationshipResults: TemplateInstallEntityRelationshipResult[] = [];

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
async function ensureTemplateWorkflows(
  template: TemplateDefinition,
  entityIdByName: Map<string, number>,
  entityRelationshipIdByRef: Map<string, number>,
): Promise<TemplateInstallWorkflowResult[]> {
  const existingWorkflows = listWorkflows();
  const workflowResults: TemplateInstallWorkflowResult[] = [];

  for (const workflowDefinition of template.workflows) {
    const workflowName = workflowDefinition.name.trim();
    if (!workflowName) {
      throw new Error('Template workflow name is required');
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
