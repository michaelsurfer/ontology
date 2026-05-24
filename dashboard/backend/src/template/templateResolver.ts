import { dataLayerClient } from '../dataLayerClient.js';
import { listWorkflows } from '../workflow/database.js';
import type { WorkflowGraph } from '../workflow/types.js';
import { loadTemplateById } from './listTemplates.js';
import { isTemplateInstalled } from './templateInstallStatus.js';
import type { TemplateDefinition } from './types.js';

export type ResolvedInstalledTemplate = {
  template: TemplateDefinition;
  primaryWorkflowId: number;
  primaryWorkflowName: string;
  workflowIds: number[];
  entityIds: number[];
};

// Return the first workflow definition name used as the template ingest pipeline.
export function resolvePrimaryWorkflowName(template: TemplateDefinition): string {
  const primaryName = String(template.workflows[0]?.name || '').trim();
  if (!primaryName) {
    throw new Error('Template must define at least one workflow');
  }
  return primaryName;
}

// Resolve entity id targeted by the primary workflow Entities node.
export async function resolvePrimaryEntityIdForTemplate(
  templateId: string,
  workflowId: number,
): Promise<number | null> {
  const workflows = listWorkflows();
  const workflow = workflows.find((row) => row.id === workflowId);
  if (!workflow) {
    return null;
  }

  const graph = JSON.parse(workflow.graph_json) as WorkflowGraph;
  const entitiesNode = graph.nodes.find((node) => node.type === 'entities');
  if (!entitiesNode) {
    return null;
  }

  const entityId = Number(entitiesNode.data?.entityId);
  if (Number.isFinite(entityId) && entityId > 0) {
    return entityId;
  }

  const entityRef = String(entitiesNode.data?.entityRef || '').trim();
  if (entityRef) {
    const template = loadTemplateById(templateId);
    const entityDefinition = template.entities.find((row) => row.name === entityRef);
    if (!entityDefinition) {
      return null;
    }
    const entities = await dataLayerClient.listEntities();
    const match = entities.find((row) => row.name === entityDefinition.name);
    return match?.id ?? null;
  }

  return null;
}

// Load installed template and resolve workflow / entity ids in the platform.
export async function resolveInstalledTemplate(
  templateId: string,
): Promise<ResolvedInstalledTemplate> {
  const template = loadTemplateById(templateId);
  const installed = await isTemplateInstalled(templateId);
  if (!installed) {
    throw new Error('Template is not installed');
  }

  const workflows = listWorkflows();
  const workflowIds: number[] = [];
  for (const workflowDefinition of template.workflows) {
    const match = workflows.find((row) => row.name === workflowDefinition.name);
    if (!match) {
      throw new Error(`Installed workflow not found: ${workflowDefinition.name}`);
    }
    workflowIds.push(match.id);
  }

  const primaryWorkflowName = resolvePrimaryWorkflowName(template);
  const primaryWorkflow = workflows.find((row) => row.name === primaryWorkflowName);
  if (!primaryWorkflow) {
    throw new Error(`Primary workflow not found: ${primaryWorkflowName}`);
  }

  const entities = await dataLayerClient.listEntities();
  const entityIds: number[] = [];
  for (const entityDefinition of template.entities) {
    const match = entities.find((row) => row.name === entityDefinition.name);
    if (!match) {
      throw new Error(`Installed entity not found: ${entityDefinition.name}`);
    }
    entityIds.push(match.id);
  }

  return {
    template,
    primaryWorkflowId: primaryWorkflow.id,
    primaryWorkflowName,
    workflowIds,
    entityIds,
  };
}
