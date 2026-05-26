import { dataLayerClient } from '../dataLayerClient.js';
import { listWorkflows } from '../workflow/database.js';
import type { WorkflowGraph } from '../workflow/types.js';
import { loadPlaybookById } from './listPlaybooks.js';
import { isPlaybookInstalled } from './playbookInstallStatus.js';
import type { PlaybookDefinition } from './types.js';

export type ResolvedInstalledPlaybook = {
  playbook: PlaybookDefinition;
  primaryWorkflowId: number;
  primaryWorkflowName: string;
  workflowIds: number[];
  entityIds: number[];
};

// Return the first workflow definition name used as the playbook ingest pipeline.
export function resolvePrimaryWorkflowName(playbook: PlaybookDefinition): string {
  const primaryName = String(playbook.workflows[0]?.name || '').trim();
  if (!primaryName) {
    throw new Error('Playbook must define at least one workflow');
  }
  return primaryName;
}

// Resolve entity id targeted by the primary workflow Entities node.
export async function resolvePrimaryEntityIdForPlaybook(
  playbookId: string,
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
    const playbook = loadPlaybookById(playbookId);
    const entityDefinition = playbook.entities.find((row) => row.name === entityRef);
    if (!entityDefinition) {
      return null;
    }
    const entities = await dataLayerClient.listEntities();
    const match = entities.find((row) => row.name === entityDefinition.name);
    return match?.id ?? null;
  }

  return null;
}

// Load installed playbook and resolve workflow / entity ids in the platform.
export async function resolveInstalledPlaybook(
  playbookId: string,
): Promise<ResolvedInstalledPlaybook> {
  const playbook = loadPlaybookById(playbookId);
  const installed = await isPlaybookInstalled(playbookId);
  if (!installed) {
    throw new Error('Playbook is not installed');
  }

  const workflows = listWorkflows();
  const workflowIds: number[] = [];
  for (const workflowDefinition of playbook.workflows) {
    const match = workflows.find((row) => row.name === workflowDefinition.name);
    if (!match) {
      throw new Error(`Installed workflow not found: ${workflowDefinition.name}`);
    }
    workflowIds.push(match.id);
  }

  const primaryWorkflowName = resolvePrimaryWorkflowName(playbook);
  const primaryWorkflow = workflows.find((row) => row.name === primaryWorkflowName);
  if (!primaryWorkflow) {
    throw new Error(`Primary workflow not found: ${primaryWorkflowName}`);
  }

  const entities = await dataLayerClient.listEntities();
  const entityIds: number[] = [];
  for (const entityDefinition of playbook.entities) {
    const match = entities.find((row) => row.name === entityDefinition.name);
    if (!match) {
      throw new Error(`Installed entity not found: ${entityDefinition.name}`);
    }
    entityIds.push(match.id);
  }

  return {
    playbook,
    primaryWorkflowId: primaryWorkflow.id,
    primaryWorkflowName,
    workflowIds,
    entityIds,
  };
}
