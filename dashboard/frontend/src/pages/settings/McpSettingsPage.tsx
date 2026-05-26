import { PageHeader } from '../../components/PageHeader';
import { McpProviderGuides } from '../../components/mcp/McpProviderGuides';
import { mcpDevStdioConfigJson } from '../../components/mcp/mcpConfigSnippet';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';

export function McpSettingsPage() {
  return (
    <Stack spacing={2}>
      <PageHeader
        title="MCP integration"
        subtitle="Connect Cursor, Claude Desktop, OpenAI Agents SDK, and other MCP hosts to AnythingGraph via stdio."
      />

      <Alert severity="info">
        Before using MCP, start <strong>data-layer-service</strong> (port 8182) and{' '}
        <strong>rdf-cache-service</strong> (port 8181). Build the MCP server with{' '}
        <code>cd mcp-service && npm install && npm run build</code>. AnythingGraph MCP speaks{' '}
        <strong>stdio</strong> — hosts must launch the Node process locally (not HTTP-only connectors).
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Connect your LLM host
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick your tool below. Each uses the same <code>mcpServers.anythinggraph</code> block.
            Installed playbooks include a playbook id — pass that in agent prompts (see Playbooks
            → Connect via MCP).
          </Typography>
          <McpProviderGuides defaultExpandFirst />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Development config (optional)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Use <code>npx tsx</code> on the TypeScript source if you prefer not to run{' '}
            <code>npm run build</code> after every change:
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: 12,
            }}
          >
            {mcpDevStdioConfigJson}
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Available MCP tools
          </Typography>
          <Typography component="ul" variant="body2" sx={{ pl: 2, m: 0 }}>
            <li>
              <code>health_check</code> — ping data-layer and rdf-cache
            </li>
            <li>
              <code>list_entities</code>, <code>get_entity</code>, <code>list_entity_rows</code>,{' '}
              <code>create_entity_row</code>, <code>update_entity_row</code>
            </li>
            <li>
              <code>create_entity</code>, <code>update_entity</code>, schema and row relationships
            </li>
            <li>
              <code>export_turtle</code>, <code>sync_rdf_cache</code>, <code>run_sparql</code>
            </li>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Resource: <code>anythinggraph://schema-summary</code> — JSON snapshot of entities and
            relationships.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Full documentation: <code>mcp-service/README.md</code> in the repository. Protocol:{' '}
            <Link href="https://modelcontextprotocol.io/" target="_blank" rel="noopener">
              modelcontextprotocol.io
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
