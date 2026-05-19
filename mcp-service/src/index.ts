import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerOntologyTools } from './tools.js';

const serverInstructions = [
  'Ontology MCP bridges data-layer-service (entities, rows, relationships) and rdf-cache-service (SPARQL).',
  'Workflow: list_entities / get_entity → read or write data → sync_rdf_cache → run_sparql (SELECT only).',
  'run_sparql syncs the cache by default; set sync_cache_before=false only if you just synced.',
  'Resource ontology://schema-summary lists current schema without side effects.',
].join(' ');

// Start the stdio MCP server for Cursor and other MCP hosts.
async function startOntologyMcpServer(): Promise<void> {
  const server = new McpServer(
    {
      name: 'ontology-mcp',
      version: '1.0.0',
    },
    {
      instructions: serverInstructions,
    },
  );

  registerOntologyTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startOntologyMcpServer().catch((error) => {
  console.error('[ontology-mcp] fatal:', error);
  process.exit(1);
});
