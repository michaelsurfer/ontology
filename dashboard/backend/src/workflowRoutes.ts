import type { Express } from 'express';
import {
  createWorkflowRecord,
  deleteWorkflowRecord,
  getWorkflowById,
  listFallbackRecordsForRun,
  listWorkflowRuns,
  listWorkflows,
  updateWorkflowRecord,
} from './workflow/database.js';
import { executeWorkflowById } from './workflow/runWorkflow.js';
import type { WorkflowGraph } from './workflow/types.js';

// Register workflow CRUD and execution routes on the dashboard API.
export function registerWorkflowRoutes(application: Express): void {
  application.get('/api/workflows', (_request, response) => {
    try {
      response.json(listWorkflows());
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.get('/api/workflows/:workflowId', (request, response) => {
    try {
      const workflowId = parseWorkflowId(request.params.workflowId);
      const workflow = getWorkflowById(workflowId);
      if (!workflow) {
        response.status(404).json({ error: 'Workflow not found' });
        return;
      }
      response.json({
        ...workflow,
        graph: JSON.parse(workflow.graph_json) as WorkflowGraph,
      });
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.post('/api/workflows', (request, response) => {
    try {
      const name = String(request.body?.name || '').trim();
      if (!name) {
        response.status(400).json({ error: 'name is required' });
        return;
      }
      const graph = parseWorkflowGraph(request.body?.graph);
      const created = createWorkflowRecord({
        name,
        description: String(request.body?.description || ''),
        graph,
      });
      response.status(201).json({
        ...created,
        graph,
      });
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.put('/api/workflows/:workflowId', (request, response) => {
    try {
      const workflowId = parseWorkflowId(request.params.workflowId);
      const name = String(request.body?.name || '').trim();
      if (!name) {
        response.status(400).json({ error: 'name is required' });
        return;
      }
      const graph = parseWorkflowGraph(request.body?.graph);
      const updated = updateWorkflowRecord(workflowId, {
        name,
        description: String(request.body?.description || ''),
        graph,
      });
      response.json({
        ...updated,
        graph,
      });
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.delete('/api/workflows/:workflowId', (request, response) => {
    try {
      const workflowId = parseWorkflowId(request.params.workflowId);
      deleteWorkflowRecord(workflowId);
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.get('/api/workflows/:workflowId/runs', (request, response) => {
    try {
      const workflowId = parseWorkflowId(request.params.workflowId);
      const runs = listWorkflowRuns(workflowId).map((run) => ({
        ...run,
        dry_run: Boolean(run.dry_run),
        result: JSON.parse(run.result_json || '{}'),
      }));
      response.json(runs);
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.get('/api/workflow-runs/:runId/fallbacks', (request, response) => {
    try {
      const runId = parseWorkflowId(request.params.runId);
      const fallbacks = listFallbackRecordsForRun(runId).map((row) => ({
        ...row,
        payload: JSON.parse(row.payload_json),
      }));
      response.json(fallbacks);
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.post('/api/workflows/:workflowId/run', async (request, response) => {
    try {
      const workflowId = parseWorkflowId(request.params.workflowId);
      const dryRun = Boolean(request.body?.dry_run);
      const inputBody = request.body?.input ?? request.body;
      const result = await executeWorkflowById(workflowId, inputBody, dryRun);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.post('/api/workflows/:workflowId/webhook', async (request, response) => {
    try {
      const workflowId = parseWorkflowId(request.params.workflowId);
      const result = await executeWorkflowById(workflowId, request.body, false);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });
}

// Parse workflow id path parameter.
function parseWorkflowId(rawValue: string): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Invalid workflow id');
  }
  return parsed;
}

// Parse workflow graph from request body.
function parseWorkflowGraph(rawGraph: unknown): WorkflowGraph {
  if (!rawGraph || typeof rawGraph !== 'object') {
    throw new Error('graph is required with nodes and edges');
  }
  const graphObject = rawGraph as WorkflowGraph;
  if (!Array.isArray(graphObject.nodes) || !Array.isArray(graphObject.edges)) {
    throw new Error('graph must include nodes[] and edges[]');
  }
  return graphObject;
}

// Format unknown route errors.
function formatRouteError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
