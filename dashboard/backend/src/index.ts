import cors from 'cors';
import express from 'express';
import { loadDashboardEnvironmentFiles } from './loadEnvFile.js';
import { dataLayerClient, getDataLayerBaseUrl } from './dataLayerClient.js';
import {
  fetchRdfCacheMeta,
  getRdfCacheBaseUrl,
  syncRdfCacheFromDataLayer,
} from './rdfCacheClient.js';
import { buildGraphFromTurtle, attachEntityIdsToClassNodes } from './turtleGraph.js';
import type { TurtleExportRequest } from './types.js';
import { getWorkflowDatabase } from './workflow/database.js';
import { registerLandingZoneRoutes } from './landingZoneRoutes.js';
import { registerPlaybookRoutes } from './playbookRoutes.js';
import { registerWorkflowRoutes } from './workflowRoutes.js';

const defaultPort = 5180;

loadDashboardEnvironmentFiles();

// Start the dashboard API that proxies data-layer-service.
function startDashboardServer() {
  const application = express();
  application.use(cors());
  application.use(express.json({ limit: '4mb' }));

  getWorkflowDatabase();
  registerWorkflowRoutes(application);
  registerLandingZoneRoutes(application);
  registerPlaybookRoutes(application);

  application.get('/api/health', async (_request, response) => {
    try {
      const dataLayerHealth = await dataLayerClient.health();
      response.json({
        ok: true,
        dataLayerUrl: getDataLayerBaseUrl(),
        dataLayer: dataLayerHealth,
      });
    } catch (error) {
      response.status(503).json({
        ok: false,
        dataLayerUrl: getDataLayerBaseUrl(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  application.get('/api/entities', async (_request, response) => {
    try {
      response.json(await dataLayerClient.listEntities());
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/entities/:entityId', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      response.json(await dataLayerClient.getEntity(entityId));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/entities', async (request, response) => {
    try {
      response.status(201).json(await dataLayerClient.createEntity(request.body));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.put('/api/entities/:entityId', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      response.json(await dataLayerClient.updateEntity(entityId, request.body));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.delete('/api/entities/:entityId', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      response.json(await dataLayerClient.deleteEntity(entityId));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/entities/:entityId/data', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      response.json(await dataLayerClient.listEntityRows(entityId));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/entities/:entityId/data', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      const values =
        request.body && typeof request.body.values === 'object' ? request.body.values : request.body;
      response.status(201).json(await dataLayerClient.createEntityRow(entityId, values));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.put('/api/entities/:entityId/data/:rowId', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      const rowId = parseNumericId(request.params.rowId, 'rowId');
      const values =
        request.body && typeof request.body.values === 'object' ? request.body.values : request.body;
      response.json(await dataLayerClient.updateEntityRow(entityId, rowId, values));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.delete('/api/entities/:entityId/data/:rowId', async (request, response) => {
    try {
      const entityId = parseNumericId(request.params.entityId, 'entityId');
      const rowId = parseNumericId(request.params.rowId, 'rowId');
      response.json(await dataLayerClient.deleteEntityRow(entityId, rowId));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/entity-relationships', async (_request, response) => {
    try {
      response.json(await dataLayerClient.listEntityRelationships());
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/entity-relationships', async (request, response) => {
    try {
      response.status(201).json(await dataLayerClient.createEntityRelationship(request.body));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.put('/api/entity-relationships/:entityRelationshipId', async (request, response) => {
    try {
      const entityRelationshipId = parseNumericId(
        request.params.entityRelationshipId,
        'entityRelationshipId',
      );
      response.json(
        await dataLayerClient.updateEntityRelationship(entityRelationshipId, request.body),
      );
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.delete('/api/entity-relationships/:entityRelationshipId', async (request, response) => {
    try {
      const entityRelationshipId = parseNumericId(
        request.params.entityRelationshipId,
        'entityRelationshipId',
      );
      response.json(await dataLayerClient.deleteEntityRelationship(entityRelationshipId));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/relationships', async (_request, response) => {
    try {
      response.json(await dataLayerClient.listRelationships());
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/relationships', async (request, response) => {
    try {
      response.status(201).json(await dataLayerClient.createRelationship(request.body));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.put('/api/relationships/:relationshipId', async (request, response) => {
    try {
      const relationshipId = parseNumericId(request.params.relationshipId, 'relationshipId');
      response.json(await dataLayerClient.updateRelationship(relationshipId, request.body));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.delete('/api/relationships/:relationshipId', async (request, response) => {
    try {
      const relationshipId = parseNumericId(request.params.relationshipId, 'relationshipId');
      response.json(await dataLayerClient.deleteRelationship(relationshipId));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/rdf/turtle', async (request, response) => {
    try {
      const exportBody = buildTurtleExportRequest(request.query);
      const turtleText = await dataLayerClient.exportTurtle(exportBody);
      response.type('text/turtle').send(turtleText);
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/rdf/turtle', async (request, response) => {
    try {
      const turtleText = await dataLayerClient.exportTurtle(request.body || { entity_ids: '*' });
      response.type('text/turtle').send(turtleText);
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/rdf/graph', async (request, response) => {
    try {
      const exportBody: TurtleExportRequest =
        request.body && typeof request.body === 'object' ? request.body : { entity_ids: '*' };
      const turtleText = await dataLayerClient.exportTurtle(exportBody);
      const entities = await dataLayerClient.listEntities();
      const graph = buildGraphFromTurtle(turtleText);
      response.json(attachEntityIdsToClassNodes(graph, entities));
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/rdf/cache-meta', async (_request, response) => {
    try {
      const meta = await fetchRdfCacheMeta();
      response.json({
        ...meta,
        rdfCacheUrl: getRdfCacheBaseUrl(),
      });
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.post('/api/rdf/sync-cache', async (request, response) => {
    try {
      const exportBody: TurtleExportRequest =
        request.body && typeof request.body === 'object' ? request.body : { entity_ids: '*' };
      const syncResult = await syncRdfCacheFromDataLayer(exportBody);
      response.json(syncResult);
    } catch (error) {
      response.status(400).json({ error: formatError(error) });
    }
  });

  application.get('/api/policy/roles', async (_request, response) => {
    try {
      const policyRoles = await dataLayerClient.listPolicyRoles();
      response.json(policyRoles);
    } catch (error) {
      response.status(502).json({ error: formatError(error) });
    }
  });

  const port = Number(process.env.DASHBOARD_API_PORT || defaultPort);
  application.listen(port, () => {
    console.log(`Dashboard API listening on http://127.0.0.1:${port}`);
    console.log(`Proxying data-layer-service at ${getDataLayerBaseUrl()}`);
    console.log(`RDF cache sync target: ${getRdfCacheBaseUrl()}`);
  });
}

// Parse a path parameter into a positive integer id.
function parseNumericId(rawValue: string, label: string): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return parsed;
}

// Format unknown errors for JSON responses.
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Build turtle export options from query string parameters.
function buildTurtleExportRequest(query: express.Request['query']): TurtleExportRequest {
  const entityIdsRaw = typeof query.entity_ids === 'string' ? query.entity_ids.trim() : '';
  if (entityIdsRaw === '*') {
    return { entity_ids: '*' };
  }
  if (entityIdsRaw) {
    const idList = entityIdsRaw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));
    return { entity_ids: idList };
  }

  const entityNamesRaw = typeof query.entity_names === 'string' ? query.entity_names.trim() : '';
  if (entityNamesRaw) {
    return {
      entity_names: entityNamesRaw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    };
  }

  return { entity_ids: '*' };
}

startDashboardServer();
