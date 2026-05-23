import { PageHeader } from '../../components/PageHeader';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';

const mcpConfigExample = `{
  "mcpServers": {
    "ontology": {
      "command": "node",
      "args": ["<absolute-path>/ontology/mcp-service/dist/index.js"],
      "env": {
        "DATA_LAYER_URL": "http://127.0.0.1:8182",
        "RDF_CACHE_URL": "http://127.0.0.1:8181"
      }
    }
  }
}`;

const mcpDevConfigExample = `{
  "mcpServers": {
    "ontology": {
      "command": "npx",
      "args": ["tsx", "<absolute-path>/ontology/mcp-service/src/index.ts"],
      "env": {
        "DATA_LAYER_URL": "http://127.0.0.1:8182",
        "RDF_CACHE_URL": "http://127.0.0.1:8181"
      }
    }
  }
}`;

export function McpSettingsPage() {
  return (
    <Stack spacing={2}>
      <PageHeader
        title="MCP integration"
        subtitle="Connect Cursor or other MCP hosts so agents can read and write entity data and run SPARQL."
      />

      <Alert severity="info">
        Before using MCP, start <strong>data-layer-service</strong> (port 8182) and{' '}
        <strong>rdf-cache-service</strong> (port 8181). Build the MCP server with{' '}
        <code>cd mcp-service && npm install && npm run build</code>.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            1. Add MCP server config
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            In Cursor, open <strong>Settings → MCP</strong> or create a project file at{' '}
            <code>.cursor/mcp.json</code> in your repo root. Replace{' '}
            <code>&lt;absolute-path&gt;</code> with the full path to this ontology repository.
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
            {mcpConfigExample}
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            2. Development config (optional)
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
            {mcpDevConfigExample}
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            3. Available tools
          </Typography>
          <Typography component="ul" variant="body2" sx={{ pl: 2, m: 0 }}>
            <li>
              <code>health_check</code> — ping data-layer and rdf-cache
            </li>
            <li>
              <code>list_entities</code>, <code>get_entity</code>, <code>list_entity_rows</code>,{' '}
              <code>create_entity_row</code>
            </li>
            <li>
              <code>list_entity_relationships</code>, <code>list_row_relationships</code>
            </li>
            <li>
              <code>export_turtle</code>, <code>sync_rdf_cache</code>, <code>run_sparql</code>
            </li>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Resource: <code>ontology://schema-summary</code> — JSON snapshot of entities and
            relationships.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Full documentation: <code>mcp-service/README.md</code> in the repository. See also{' '}
            <Link href="https://modelcontextprotocol.io/" target="_blank" rel="noopener">
              modelcontextprotocol.io
            </Link>
            .
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
