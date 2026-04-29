import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
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
          Developer documentation for the Ontology Platform APIs and the OntoX SDK/CLI.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Quick links
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
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
              Returns builtin CRM entities and custom entities with their active columns.
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
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create/delete custom entities and manage fields (add column, toggle active/required).
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
        </CardContent>
      </Card>

      <Card variant="outlined" id="ingestion-api">
        <CardContent>
          <Typography variant="h6">Ingestion + Suggestions API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Ingest real-time events, then review and publish ontology suggestions (review before apply).
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
            <Typography variant="subtitle2">Example: inject data (POST)</Typography>
            <Typography variant="body2" color="text.secondary">
              This is the single “front door” for real-time data. The backend stores the raw payload and generates draft
              ontology suggestions for review.
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
              Approve/reject individual suggestions, then publish approved suggestions into the live ontology.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" id="sparql-api">
        <CardContent>
          <Typography variant="h6">SPARQL API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            SPARQL queries execute against an in-memory RDF graph built from current relational
            data + mappings at query time.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            POST /api/sparql
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Body
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {`{
  "query": "PREFIX ex: <http://example.com/ontology#> SELECT ...",
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
            Exports Turtle (TTL) for the current ontology + instance data (depending on options).
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
  queryText: 'PREFIX ex: <http://example.com/ontology#> SELECT * WHERE { ?s ?p ?o } LIMIT 5',
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
    query_text="PREFIX ex: <http://example.com/ontology#> SELECT * WHERE { ?s ?p ?o } LIMIT 5",
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
node packages/ontox-cli/src/main.js sparql query --query "PREFIX ex: <http://example.com/ontology#> SELECT * WHERE { ?s ?p ?o } LIMIT 1" --json`}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            Tip: if you later publish the CLI, the command can simply be <code>ontox</code>. For now
            this repo runs it via Node.
          </Typography>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary">
        Missing something? Tell me which endpoints/flows you want to document (relationships, SHACL
        rules, mappings), and I’ll extend this page.
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Related: see the repo README at{' '}
        <Link href="/" onClick={(event) => event.preventDefault()}>
          README.md
        </Link>
        .
      </Typography>
    </Stack>
  )
}

