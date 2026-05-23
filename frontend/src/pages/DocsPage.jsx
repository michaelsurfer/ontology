import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material'

/* Render API + SDK documentation for developers. */
export function DocsPage() {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4">Docs</Typography>
        <Typography variant="body1" color="text.secondary">
          Developer documentation for the AnythingGraph APIs, the Rust RDF cache + SPARQL service, and the OntoX SDK/CLI.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Quick links
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip label="Architecture" component="a" href="#architecture" clickable />
            <Chip label="Backend API" component="a" href="#backend-api" clickable />
            <Chip label="Ingestion + Suggestions" component="a" href="#ingestion-api" clickable />
            <Chip label="SPARQL API" component="a" href="#sparql-api" clickable />
            <Chip label="RDF Export API" component="a" href="#rdf-export-api" clickable />
            <Chip label="SDK (JS)" component="a" href="#sdk-js" clickable />
            <Chip label="SDK (Python)" component="a" href="#sdk-python" clickable />
            <Chip label="CLI" component="a" href="#cli" clickable />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" id="architecture">
        <CardContent>
          <Typography variant="h6">Architecture</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            <b>Node backend</b> owns SQLite, CRUD, RDF Turtle export, SHACL validation, and the schema graph for the UI (
            <code>GET /api/graph/schema</code>). After you create or edit data, mappings, relationships, or ontology
            settings, the backend tries to <b>refresh the Rust cache</b> by re-exporting Turtle and calling the Rust
            service <code>POST /cache/load</code> (best effort; writes still succeed if Rust is down).
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            <b>Rust service</b> (<code>rdf-cache-service/</code>) holds an in-memory Turtle cache and runs{' '}
            <b>SPARQL SELECT</b> with Oxigraph. Query Studio and <code>POST /api/sparql</code> go through this service.
            The <b>context map</b> in the app does not require Rust; it reads schema metadata from Node only.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Backend env: <code>RDF_CACHE_URL</code> (default <code>http://127.0.0.1:8181</code>). Run Rust with{' '}
            <code>cd rdf-cache-service && cargo run</code> — see repo <code>README.md</code> and{' '}
            <code>rdf-cache-service/README.md</code>.
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" id="backend-api">
        <CardContent>
          <Typography variant="h6">Backend API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The frontend calls the backend using relative URLs under <b>/api</b>. In local dev the
            Vite dev server proxies these to <b>http://localhost:5174</b>.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Entities (for dropdowns + graph)</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/entities
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Returns custom entities (and link-table entities where applicable) with active columns for forms and
              joins.
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Relationships</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/relationships
              <br />
              POST /api/relationships
              <br />
              PUT /api/relationships/:id
              <br />
              DELETE /api/relationships/:id
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Defines object properties between entities; many-to-many uses a system-managed SQL link table. Successful
              mutations refresh the Rust RDF cache when the service is reachable.
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Schema graph (Context map)</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/graph/schema
            </Typography>
            <Typography variant="body2" color="text.secondary">
              JSON nodes/edges for the graph visualization — served from SQLite, independent of the Rust SPARQL service.
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Custom entities (real SQL tables)</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/custom-entities
              <br />
              POST /api/custom-entities
              <br />
              DELETE /api/custom-entities/:entityName
              <br />
              POST /api/custom-entities/:entityName/fields
              <br />
              PUT /api/custom-entities/:entityName/fields/:fieldId
              <br />
              DELETE /api/custom-entities/:entityName/fields/:fieldId
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create/delete custom entities and manage fields (add column, drop column, toggle active/required).
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Custom entity rows CRUD</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/custom/:entityName
              <br />
              POST /api/custom/:entityName
              <br />
              PUT /api/custom/:entityName/:id
              <br />
              DELETE /api/custom/:entityName/:id
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage rows stored inside dynamically created SQLite tables.
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">AI Planning</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/ai/plan/prompt
              <br />
              PUT /api/ai/plan/prompt
              <br />
              POST /api/ai/plan
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Planner loop using the NL→SPARQL skill; planner prompt lives in <code>ai_planning_settings</code>.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" id="ingestion-api">
        <CardContent>
          <Typography variant="h6">Ingestion + Suggestions API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Ingest real-time events, then review and publish suggested changes (review before apply).
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Ingest events (webhook / SDK)</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              POST /api/ingest/events
              <br />
              GET /api/ingest/events?limit=100
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stores raw events and generates draft suggestions (entity creation, fields, relationships, rules).
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Auto-inject (no entity_name / ai_mode)</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              POST /api/auto-inject
              <br />
              GET /api/auto-inject/unmapped?limit=100
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sends JSON objects (single object, array, or <code>records</code>). The backend picks the custom entity
              whose active columns best overlap with payload keys (snake_case or camelCase). Ambiguous or unknown shapes
              are stored in <code>auto_inject_unmapped</code>. Optional <code>source</code> on the envelope tags landing
              rows for audit.
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Example: inject data (POST)</Typography>
            <Typography variant="body2" color="text.secondary">
              This is the single “front door” for real-time data. The backend stores the raw payload and generates draft
              suggested changes for review.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              curl
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {`curl -X POST http://localhost:5174/api/ingest/events \\
  -H "Content-Type: application/json" \\
  -d '{
  "entity_name": "contacts",
  "ai_mode": false,
  "data": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@example.com",
    "account_id": "account_456"
  },
  "occurredAt": "2026-04-28T20:00:00Z",
  "links": [
    {
      "predicate": "belongs_to",
      "targetEntityType": "accounts",
      "targetExternalId": "account_456",
      "subjectColumn": "account_id",
      "objectColumn": "external_id"
    }
}'`}
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Response (202)
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {`{
  "accepted": 1,
  "insertedEvents": 1,
  "insertedSuggestions": 3,
  "insertedRows": 1
}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Note: `entity_name` and `ai_mode` are mandatory. Counts depend on what is already in your database.
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Suggestions (review before apply)</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              GET /api/suggestions?status=draft
              <br />
              POST /api/suggestions/:id/approve
              <br />
              POST /api/suggestions/:id/reject
              <br />
              POST /api/suggestions/publish
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approve/reject individual suggestions, then publish approved suggestions into the live context layer.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" id="sparql-api">
        <CardContent>
          <Typography variant="h6">SPARQL API (via Node → Rust)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The backend builds or refreshes Turtle from SQLite (see export options below), keeps it in the{' '}
            <b>Rust RDF cache service</b>, and runs <b>SPARQL SELECT</b> with <b>Oxigraph</b>. If the cache is empty,
            the first query can trigger a warm-up (export + <code>POST /cache/load</code> on Rust). For reliable Query
            Studio usage, run <code>rdf-cache-service</code> locally (default <code>127.0.0.1:8181</code>).
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            POST /api/sparql
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Direct Rust endpoint (same graph as cache):{' '}
            <code>POST {'{RDF_CACHE_URL}'}/sparql/query</code> with body{' '}
            <code>{`{ "query": "SELECT ..." }`}</code>.
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Body
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`{
  "query": "PREFIX ex: <http://example.com/context#> SELECT ...",
  "includeOntology": true,
  "includeData": true,
  "maxRowsPerEntity": 200
}`}
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Response
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`{
  "variables": ["?s", "?p", "?o"],
  "rows": [
    { "?s": "...", "?p": "...", "?o": "..." }
  ],
  "executionTimeMs": 19
}`}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" id="rdf-export-api">
        <CardContent>
          <Typography variant="h6">RDF Export API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Exports Turtle (TTL) for the current model + instance data (depending on options). This runs entirely in the
            Node backend; use it to inspect graph text or to manually load Turtle into the Rust cache if needed.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            POST /api/rdf/export
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Body
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`{
  "includeOntology": true,
  "includeData": true,
  "maxRowsPerEntity": 200
}`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Response is plain text Turtle.
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" id="sdk-js">
        <CardContent>
          <Typography variant="h6">SDK (JavaScript)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Package: <b>ontox</b> (local in this repo under <code>packages/ontox-js</code>)
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2">Example</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`import { OntoXClient } from 'ontox'

const client = new OntoXClient({ baseUrl: 'http://localhost:5174' })

const entities = await client.entities.list()
const sparqlResult = await client.sparql.query({
  queryText: 'PREFIX ex: <http://example.com/context#> SELECT * WHERE { ?s ?p ?o } LIMIT 5',
  includeOntology: true,
  includeData: true,
  maxRowsPerEntity: 200,
})

console.log({ entities, sparqlResult })`}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" id="sdk-python">
        <CardContent>
          <Typography variant="h6">SDK (Python)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Package: <b>ontox</b> (local in this repo under <code>packages/ontox-py</code>)
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2">Example</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`from ontox import OntoXClient

client = OntoXClient(base_url="http://localhost:5174")

entities = client.entities.list()
result = client.sparql.query(
    query_text="PREFIX ex: <http://example.com/context#> SELECT * WHERE { ?s ?p ?o } LIMIT 5",
    include_ontology=True,
    include_data=True,
    max_rows_per_entity=200,
)

print(entities)
print(result)`}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" id="cli">
        <CardContent>
          <Typography variant="h6">CLI</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The CLI in this repo is under <code>packages/ontox-cli</code>.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2">Examples</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`# list entities
node packages/ontox-cli/src/main.js entities list --json

# run SPARQL
node packages/ontox-cli/src/main.js sparql query --query "PREFIX ex: <http://example.com/context#> SELECT * WHERE { ?s ?p ?o } LIMIT 1" --json`}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            Tip: if you later publish the CLI, the command can simply be <code>ontox</code>. For now
            this repo runs it via Node.
          </Typography>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary">
        For SHACL rules, mappings, and ontology settings, use the in-app pages or open an issue with the flows you want
        documented here.
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Related: see the repository root <code>README.md</code> and <code>rdf-cache-service/README.md</code> for runbooks
        and curl examples.
      </Typography>
    </Stack>
  )
}

