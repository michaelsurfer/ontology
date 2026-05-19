/**
 * Smoke-test the ontology MCP server over stdio (same transport Cursor uses).
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverEntryPath = join(scriptDirectory, '..', 'dist', 'index.js');

function extractTextFromToolResult(toolResult) {
  const textParts = (toolResult.content || [])
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text);
  return textParts.join('\n');
}

async function runMcpSmokeTest() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverEntryPath],
    env: {
      DATA_LAYER_URL: process.env.DATA_LAYER_URL || 'http://127.0.0.1:8182',
      RDF_CACHE_URL: process.env.RDF_CACHE_URL || 'http://127.0.0.1:8181',
    },
    stderr: 'pipe',
  });

  const client = new Client({ name: 'ontology-mcp-test', version: '1.0.0' });

  console.log('Connecting to MCP server:', serverEntryPath);
  await client.connect(transport);

  const serverVersion = client.getServerVersion();
  const instructions = client.getInstructions();
  console.log('Server:', serverVersion?.name, serverVersion?.version);
  if (instructions) {
    console.log('Instructions (first 120 chars):', instructions.slice(0, 120) + '...');
  }

  const toolsList = await client.listTools();
  const toolNames = (toolsList.tools || []).map((tool) => tool.name).sort();
  console.log('\nTools (' + toolNames.length + '):', toolNames.join(', '));

  console.log('\n--- health_check ---');
  const healthResult = await client.callTool({ name: 'health_check', arguments: {} });
  console.log(extractTextFromToolResult(healthResult));

  console.log('\n--- list_entities ---');
  const entitiesResult = await client.callTool({ name: 'list_entities', arguments: {} });
  const entitiesText = extractTextFromToolResult(entitiesResult);
  const entities = JSON.parse(entitiesText);
  console.log('Entity count:', Array.isArray(entities) ? entities.length : 'n/a');
  if (Array.isArray(entities) && entities.length > 0) {
    console.log('Sample:', JSON.stringify(entities.slice(0, 3)));
  }

  console.log('\n--- resource ontology://schema-summary ---');
  const resourceResult = await client.readResource({ uri: 'ontology://schema-summary' });
  const resourceText = resourceResult.contents?.[0]?.text || '';
  const summary = JSON.parse(resourceText);
  console.log('Entities in summary:', summary.entities?.length ?? 0);

  await client.close();
  console.log('\nMCP smoke test passed.');
}

runMcpSmokeTest().catch((error) => {
  console.error('\nMCP smoke test failed:', error);
  process.exit(1);
});
