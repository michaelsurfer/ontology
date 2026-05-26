import { loadPlaybookById, normalizePlaybookId } from './listPlaybooks.js';
import { isPlaybookInstalled } from './playbookInstallStatus.js';
import type { PlaybookDefinition } from './types.js';
import type { WorkflowGraph, WorkflowGraphNode } from '../workflow/types.js';

export type PlaybookDetailEntity = PlaybookDefinition['entities'][number];

export type PlaybookDetailEntityRelationship = NonNullable<
  PlaybookDefinition['entity_relationships']
>[number];

export type PlaybookDetailWorkflow = {
  name: string;
  description?: string;
  pipelineSteps: string[];
};

export type PlaybookDetailResponse = {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  installed: boolean;
  entities: PlaybookDetailEntity[];
  entityRelationships: PlaybookDetailEntityRelationship[];
  workflows: PlaybookDetailWorkflow[];
};

// Load full playbook definition and install status for the detail page.
export async function getPlaybookDetail(rawPlaybookId: string): Promise<PlaybookDetailResponse> {
  const playbookId = normalizePlaybookId(rawPlaybookId);
  const playbook = loadPlaybookById(playbookId);
  const installed = await isPlaybookInstalled(playbookId);

  return {
    id: playbook.id,
    name: playbook.name,
    description: playbook.description,
    instructions: playbook.instructions,
    installed,
    entities: playbook.entities,
    entityRelationships: playbook.entity_relationships || [],
    workflows: playbook.workflows.map((workflowDefinition) => ({
      name: workflowDefinition.name,
      description: workflowDefinition.description,
      pipelineSteps: summarizeWorkflowPipeline(workflowDefinition.graph),
    })),
  };
}

// Walk the workflow graph from the trigger and list human-readable pipeline steps.
function summarizeWorkflowPipeline(graph: WorkflowGraph): string[] {
  const triggerNode = graph.nodes.find((node) => node.type === 'trigger');
  if (!triggerNode) {
    return graph.nodes.map((node) => describeWorkflowNode(node));
  }

  const steps: string[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNodeIds = graph.edges
    .filter((edge) => edge.source === triggerNode.id)
    .map((edge) => edge.target);

  steps.push(describeWorkflowNode(triggerNode));

  while (currentNodeIds.length > 0) {
    const nextNodeIds: string[] = [];

    for (const nodeId of currentNodeIds) {
      if (visitedNodeIds.has(nodeId)) {
        continue;
      }
      visitedNodeIds.add(nodeId);

      const workflowNode = graph.nodes.find((node) => node.id === nodeId);
      if (!workflowNode) {
        continue;
      }

      steps.push(describeWorkflowNode(workflowNode));
      const outgoingTargets = graph.edges
        .filter((edge) => edge.source === workflowNode.id && edge.sourceHandle !== 'failure')
        .map((edge) => edge.target);
      nextNodeIds.push(...outgoingTargets);
    }

    currentNodeIds = nextNodeIds;
  }

  return steps;
}

// Format one workflow node for the playbook detail page.
function describeWorkflowNode(node: WorkflowGraphNode): string {
  const nodeData = node.data || {};
  const label = String(nodeData.label || node.type).trim();

  if (node.type === 'trigger') {
    const triggerType = String(nodeData.triggerType || 'manual');
    return `Trigger (${triggerType})`;
  }

  if (node.type === 'entities') {
    const entityRef = String(nodeData.entityRef || '').trim();
    return entityRef ? `Entities → ${entityRef}` : `Entities — ${label}`;
  }

  if (node.type === 'relationships') {
    const relationshipRef = String(nodeData.entityRelationshipRef || '').trim();
    return relationshipRef ? `Relationships → ${relationshipRef}` : `Relationships — ${label}`;
  }

  if (node.type === 'field_mapper') {
    const mappingCount = Array.isArray(nodeData.mappings) ? nodeData.mappings.length : 0;
    return mappingCount > 0 ? `Field mapper (${mappingCount} rule(s))` : `Field mapper — ${label}`;
  }

  if (node.type === 'validate') {
    const ruleCount = Array.isArray(nodeData.rules) ? nodeData.rules.length : 0;
    return ruleCount > 0 ? `Validate (${ruleCount} rule(s))` : `Validate — ${label}`;
  }

  if (node.type === 'fallback') {
    const action = String(nodeData.action || 'landing_zone');
    return `Fallback (${action})`;
  }

  return label || node.type;
}
