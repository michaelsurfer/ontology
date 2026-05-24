import {
  createWorkflowRun,
  finishWorkflowRun,
  getWorkflowById,
  insertFallbackRecords,
  insertLandingZoneRecords,
} from './database.js';
import { executeWorkflowGraph } from './executor.js';
import type { WorkflowGraph } from './types.js';

// Read fallback node action from the workflow graph (default: landing zone).
function readFallbackActionFromGraph(graph: WorkflowGraph): 'landing_zone' | 'stop' {
  const fallbackNode = graph.nodes.find((node) => node.type === 'fallback');
  if (!fallbackNode) {
    return 'landing_zone';
  }
  const action = String(fallbackNode.data?.action || 'landing_zone');
  if (action === 'stop') {
    return 'stop';
  }
  return 'landing_zone';
}

// Run a saved workflow with the given JSON input body.
export async function executeWorkflowById(
  workflowId: number,
  inputBody: unknown,
  dryRun: boolean,
) {
  const workflow = getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const graph = JSON.parse(workflow.graph_json) as WorkflowGraph;
  const runRow = createWorkflowRun({
    workflowId,
    dryRun,
    inputJson: JSON.stringify(inputBody ?? {}),
  });

  try {
    const executionResult = await executeWorkflowGraph({
      graph,
      inputBody,
      dryRun,
    });

    if (!dryRun && executionResult.fallbackRecords.length > 0) {
      insertFallbackRecords(runRow.id, executionResult.fallbackRecords);

      const fallbackAction = readFallbackActionFromGraph(graph);
      if (fallbackAction === 'landing_zone') {
        insertLandingZoneRecords({
          workflowId,
          workflowName: workflow.name,
          runId: runRow.id,
          records: executionResult.fallbackRecords,
        });
      }
    }

    finishWorkflowRun(runRow.id, 'completed', JSON.stringify(executionResult));
    return {
      run_id: runRow.id,
      workflow_id: workflowId,
      status: 'completed',
      dry_run: dryRun,
      result: executionResult,
    };
  } catch (executionError) {
    finishWorkflowRun(
      runRow.id,
      'failed',
      JSON.stringify({
        error: executionError instanceof Error ? executionError.message : String(executionError),
      }),
    );
    throw executionError;
  }
}
