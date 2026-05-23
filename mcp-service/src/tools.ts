import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDataLayerBaseUrl, getRdfCacheBaseUrl } from './config.js';
import { dataLayerClient } from './dataLayerClient.js';
import { rdfCacheHealth, runSparqlQuery, syncRdfCacheFromDataLayer } from './rdfCacheClient.js';
import { errorToolResult, jsonToolResult } from './toolResults.js';

// Parse export scope from tool arguments (flat schema for faster TypeScript checking).
function buildExportScope(entityIdsStar: boolean | undefined, entityIdList: string | undefined) {
  if (entityIdList && entityIdList.trim()) {
    const parsedIds = entityIdList
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (parsedIds.length === 0) {
      throw new Error('entity_id_list must be comma-separated positive integers');
    }
    return { entity_ids: parsedIds as number[] };
  }
  if (entityIdsStar === false) {
    return { entity_ids: '*' as const };
  }
  return { entity_ids: '*' as const };
}

// Register all AnythingGraph MCP tools on the server.
export function registerOntologyTools(server: McpServer): void {
  server.tool('health_check', 'Check data-layer-service and rdf-cache-service connectivity.', {}, async () => {
    try {
      const [dataLayerHealth, rdfCacheHealthResult] = await Promise.all([
        dataLayerClient.health(),
        rdfCacheHealth(),
      ]);
      return jsonToolResult({
        ok: true,
        dataLayerUrl: getDataLayerBaseUrl(),
        rdfCacheUrl: getRdfCacheBaseUrl(),
        dataLayer: dataLayerHealth,
        rdfCache: rdfCacheHealthResult,
      });
    } catch (error) {
      return errorToolResult(error instanceof Error ? error.message : String(error));
    }
  });

  server.tool('list_entities', 'List all entity schemas (id and name).', {}, async () => {
    try {
      return jsonToolResult(await dataLayerClient.listEntities());
    } catch (error) {
      return errorToolResult(error instanceof Error ? error.message : String(error));
    }
  });

  server.tool(
    'get_entity',
    'Fetch full entity definition including fields.',
    { entity_id: z.number().describe('Entity id from list_entities') },
    async ({ entity_id: entityId }) => {
      try {
        return jsonToolResult(await dataLayerClient.getEntity(entityId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'list_entity_rows',
    'List all data rows for an entity.',
    { entity_id: z.number().describe('Entity id') },
    async ({ entity_id: entityId }) => {
      try {
        return jsonToolResult(await dataLayerClient.listEntityRows(entityId));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'create_entity_row',
    'Insert a new row. Values keys must match field_name on the entity schema.',
    {
      entity_id: z.number().describe('Entity id'),
      values_json: z
        .string()
        .describe('JSON object of field values, e.g. {"email":"a@example.com"}'),
    },
    async ({ entity_id: entityId, values_json: valuesJson }) => {
      try {
        const values = JSON.parse(valuesJson) as Record<string, unknown>;
        if (!values || typeof values !== 'object' || Array.isArray(values)) {
          throw new Error('values_json must be a JSON object');
        }
        return jsonToolResult(await dataLayerClient.createEntityRow(entityId, values));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'list_entity_relationships',
    'List schema-level relationships between entity types.',
    {},
    async () => {
      try {
        return jsonToolResult(await dataLayerClient.listEntityRelationships());
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'list_row_relationships',
    'List instance links between specific rows.',
    {},
    async () => {
      try {
        return jsonToolResult(await dataLayerClient.listRelationships());
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'export_turtle',
    'Export RDF Turtle from data-layer without loading cache. Default: full graph.',
    {
      full_graph: z
        .boolean()
        .optional()
        .describe('If true (default), export all entities. If false, use entity_id_list.'),
      entity_id_list: z
        .string()
        .optional()
        .describe('Comma-separated entity ids when full_graph is false'),
    },
    async ({ full_graph: fullGraph, entity_id_list: entityIdList }) => {
      try {
        const exportScope =
          fullGraph === false ? buildExportScope(false, entityIdList) : { entity_ids: '*' as const };
        const turtleText = await dataLayerClient.exportTurtle(exportScope);
        return { content: [{ type: 'text' as const, text: turtleText }] };
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'sync_rdf_cache',
    'Export Turtle from data-layer and load into rdf-cache (replace=true). Run before SPARQL.',
    {
      full_graph: z.boolean().optional().describe('If true (default), sync full graph'),
      entity_id_list: z.string().optional().describe('Comma-separated entity ids when full_graph is false'),
    },
    async ({ full_graph: fullGraph, entity_id_list: entityIdList }) => {
      try {
        const exportScope =
          fullGraph === false ? buildExportScope(false, entityIdList) : { entity_ids: '*' as const };
        return jsonToolResult(await syncRdfCacheFromDataLayer(exportScope));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.tool(
    'run_sparql',
    'Execute SPARQL SELECT on rdf-cache. Syncs cache from data-layer first unless sync_cache_before is false.',
    {
      query: z.string().describe('SPARQL SELECT query'),
      sync_cache_before: z
        .boolean()
        .optional()
        .describe('Default true: reload cache before query'),
      full_graph: z.boolean().optional().describe('When syncing, export full graph (default true)'),
      entity_id_list: z.string().optional().describe('Comma-separated entity ids when full_graph is false'),
    },
    async ({
      query,
      sync_cache_before: syncCacheBefore,
      full_graph: fullGraph,
      entity_id_list: entityIdList,
    }) => {
      try {
        const shouldSync = syncCacheBefore !== false;
        if (shouldSync) {
          const exportScope =
            fullGraph === false ? buildExportScope(false, entityIdList) : { entity_ids: '*' as const };
          await syncRdfCacheFromDataLayer(exportScope);
        }
        return jsonToolResult(await runSparqlQuery(query));
      } catch (error) {
        return errorToolResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.resource(
    'anythinggraph_schema_summary',
    'anythinggraph://schema-summary',
    {
      title: 'AnythingGraph schema summary',
      description: 'Entities and relationships from data-layer-service',
      mimeType: 'application/json',
    },
    async () => {
      const [entities, entityRelationships, rowRelationships] = await Promise.all([
        dataLayerClient.listEntities(),
        dataLayerClient.listEntityRelationships(),
        dataLayerClient.listRelationships(),
      ]);

      const summary = {
        dataLayerUrl: getDataLayerBaseUrl(),
        rdfCacheUrl: getRdfCacheBaseUrl(),
        entities,
        entity_relationships: entityRelationships,
        row_relationships: rowRelationships,
        sparql_note:
          'Call sync_rdf_cache before SPARQL, or run_sparql with sync_cache_before true (default).',
      };

      return {
        contents: [
          {
            uri: 'anythinggraph://schema-summary',
            mimeType: 'application/json',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );
}
