// Shared stdio MCP server JSON for AnythingGraph (replace path placeholder before use).
export const MCP_STDIO_CONFIG_PLACEHOLDER = '<absolute-path>/ontology/mcp-service/dist/index.js';

export const mcpStdioConfigJson = `{
  "mcpServers": {
    "anythinggraph": {
      "command": "node",
      "args": ["${MCP_STDIO_CONFIG_PLACEHOLDER}"],
      "env": {
        "DATA_LAYER_URL": "http://127.0.0.1:8182",
        "RDF_CACHE_URL": "http://127.0.0.1:8181"
      }
    }
  }
}`;

export const mcpDevStdioConfigJson = `{
  "mcpServers": {
    "anythinggraph": {
      "command": "npx",
      "args": ["tsx", "<absolute-path>/ontology/mcp-service/src/index.ts"],
      "env": {
        "DATA_LAYER_URL": "http://127.0.0.1:8182",
        "RDF_CACHE_URL": "http://127.0.0.1:8181"
      }
    }
  }
}`;

export type McpHostGuide = {
  hostId: string;
  title: string;
  configPath: string;
  steps: string[];
  notes?: string[];
  docUrl?: string;
  docLabel?: string;
};

// Setup steps per MCP-capable host (stdio transport).
export const mcpHostGuides: McpHostGuide[] = [
  {
    hostId: 'cursor',
    title: 'Cursor',
    configPath: 'Settings → MCP, or project file .cursor/mcp.json',
    steps: [
      'Start data-layer (8182) and rdf-cache (8181), then build mcp-service.',
      'Add the anythinggraph server block below (use your repo absolute path).',
      'Reload MCP in Cursor and confirm the server shows as connected.',
      'In chat, ask the agent to call health_check, then use your playbook id.',
    ],
    docUrl: 'https://docs.cursor.com/context/mcp',
    docLabel: 'Cursor MCP docs',
  },
  {
    hostId: 'claude',
    title: 'Claude Desktop',
    configPath:
      'Settings → Developer → Edit Config (claude_desktop_config.json — location varies by OS)',
    steps: [
      'Open Claude Desktop settings and edit the MCP configuration JSON file.',
      'Add the same mcpServers.anythinggraph block as below under top-level mcpServers.',
      'Restart Claude Desktop so the MCP server starts.',
      'In a new chat, verify tools appear and run health_check before ingest.',
    ],
    docUrl: 'https://modelcontextprotocol.io/docs',
    docLabel: 'Model Context Protocol docs',
  },
  {
    hostId: 'openai',
    title: 'OpenAI (Agents SDK and compatible apps)',
    configPath:
      'Your app code (Agents SDK MCPServerStdio) or host app MCP settings if supported',
    steps: [
      'AnythingGraph ships a stdio MCP server — use an MCP client that launches node with args (not HTTP-only).',
      'In OpenAI Agents SDK (Python/JS), connect via MCPServerStdio with command node and the dist/index.js path.',
      'Pass the same DATA_LAYER_URL and RDF_CACHE_URL env vars as in the JSON below.',
      'In agent instructions, include playbook id and ask the agent to call list_entities / get_entity before writing rows.',
    ],
    notes: [
      'ChatGPT connectors and OpenAI Responses remote MCP require an HTTP MCP bridge; this repo provides stdio — use SDK or a stdio-capable host.',
      'For custom pipelines, you can also shell out to: node mcp-service/scripts/test-mcp.mjs (smoke test).',
    ],
    docUrl: 'https://platform.openai.com/docs/guides/agents-mcp',
    docLabel: 'OpenAI Agents MCP guide',
  },
  {
    hostId: 'other',
    title: 'Other LLM tools (Windsurf, Cline, Zed, custom)',
    configPath: 'Host-specific MCP or mcp.json (same JSON shape as Cursor)',
    steps: [
      'If the tool supports MCP over stdio, register command node pointing at mcp-service/dist/index.js.',
      'Copy the mcpServers block below into the host config (wrap in mcpServers if required).',
      'Set env DATA_LAYER_URL and RDF_CACHE_URL to your running services.',
      'Restart the host, list tools, run health_check, then reference playbook id in prompts.',
    ],
    notes: [
      'MCP transports differ by host; AnythingGraph supports stdio only in mcp-service today.',
      'See mcp-service/README.md in the repository for tool list and typical agent workflow.',
    ],
    docUrl: 'https://modelcontextprotocol.io/clients',
    docLabel: 'MCP clients list',
  },
];
