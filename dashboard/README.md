# Ontology Dashboard

TypeScript dashboard for managing ontology data through **data-layer-service** (port `8182`).

## Stack

- **Backend** (`dashboard/backend`) — Express proxy on port `5180`, Turtle → graph parsing with `n3`
- **Frontend** (`dashboard/frontend`) — React + MUI + React Flow on port `5183`

## Prerequisites

1. **data-layer-service** running:

```bash
cd data-layer-service
cargo run
```

2. **rdf-cache-service** running (for **Sync cache** in the sidebar):

```bash
cd rdf-cache-service
cargo run
```

3. Install dashboard dependencies:

```bash
cd dashboard
npm install
npm --prefix backend install
npm --prefix frontend install
```

## Run

**All platform services** (data-layer, rdf-cache, dashboard, mcp):

```bash
# From repository root
./scripts/start-all.sh
# or: npm run start:all
```

**Dashboard only** (requires data-layer and rdf-cache already running):

```bash
cd dashboard
npm run dev
```

- UI: http://127.0.0.1:5183
- API: http://127.0.0.1:5180

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_LAYER_URL` | `http://127.0.0.1:8182` | data-layer-service base URL (backend) |
| `RDF_CACHE_URL` | `http://127.0.0.1:8181` | rdf-cache-service for **Sync cache** |
| `DASHBOARD_API_PORT` | `5180` | Dashboard API port |
| `DASHBOARD_WORKFLOW_DB_PATH` | `dashboard/backend/data/dashboard-workflows.sqlite` | Workflow definitions & run history |

## Features

- **Entities** — create, list, delete entity schemas; open entity to manage row data
- **Entity relationships** — schema-level links between entity types (`/entity-relationships`)
- **Row links** — instance links between rows (`/relationships`)
- **RDF graph** — export Turtle via data-layer and visualize as an interactive graph
- **Workflows** — node canvas (Trigger → Entities → Relationships → Fallback) with SQLite-stored definitions and ingest runs
- **Landing zone** — review records sent from workflow fallback nodes

## API routes (dashboard backend)

All under `/api/*`, proxied to data-layer-service:

- `GET/POST/PUT/DELETE /api/entities`
- `GET/POST/PUT/DELETE /api/entities/:id/data` and `.../data/:rowId`
- `GET/POST/PUT/DELETE /api/entity-relationships`
- `GET/POST/PUT/DELETE /api/relationships`
- `POST /api/rdf/turtle` — raw Turtle text
- `POST /api/rdf/graph` — `{ nodes, edges, turtlePreview }` for the graph view
- `POST /api/rdf/sync-cache` — export Turtle from data-layer, then `POST /cache/load` on rdf-cache-service
- `GET/POST/PUT/DELETE /api/workflows` — workflow CRUD (graph stored in SQLite)
- `POST /api/workflows/:id/run` — execute canvas pipeline (`dry_run` supported)
- `POST /api/workflows/:id/webhook` — trigger workflow via HTTP (JSON body = ingest payload)
- `GET/DELETE /api/landing-zone` — list or remove landing zone records
