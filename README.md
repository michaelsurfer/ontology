# AnythingGraph

AnythingGraph is a graph / context-layer platform: custom entities in SQLite, OWL-style mappings, relationships (including SQL link tables), RDF Turtle export, SHACL rules, and **Query Studio** (natural language → SPARQL → results).

## Architecture (high level)

- **Node backend** (`backend/`): Express API, SQLite, RDF export (`createRdfTurtleExport`), schema graph for the UI, AI chat / planning. After writes that affect the graph, it **refreshes** the Rust cache (best effort).
- **Rust service** (`rdf-cache-service/`): In-memory Turtle cache plus **SPARQL SELECT** via **Oxigraph**. The backend’s `/api/sparql` and AI SPARQL path call this service.
- **Rust data layer** (`data-layer-service/`): LMDB-backed entities, rows, relationships, Turtle export (port `8182`).
- **MCP server** (`mcp-service/`): TypeScript stdio MCP for Cursor/agents → data-layer + rdf-cache (see `mcp-service/README.md`).
- **Dashboard** (`dashboard/`): TypeScript admin UI for data-layer (port `5183`).
- **React frontend** (`frontend/`): Objects, relationships, mappings, rules, graph view, Query Studio.

The **context map** (schema graph) is served from the Node API (`GET /api/graph/schema`) and does **not** require Rust. **SPARQL / Query Studio** expects the Rust service to be running.

## Run locally

### 1. Backend (required)

```bash
cd backend
npm install
npm run dev
```

API: `http://localhost:5174`  
SQLite: `backend/data/ontology-platform.sqlite` (gitignored local DB).

### 2. Rust RDF + SPARQL service (required for SPARQL / Query Studio)

Install [Rust](https://rustup.rs/), then:

```bash
cd rdf-cache-service
cp .env.example .env   # optional; defaults shown inside
cargo run
```

Default listen address: `http://127.0.0.1:8181`

Endpoints include:

- `GET /health`
- `POST /cache/load` — push Turtle (`replace: true` overwrites cache)
- `GET /cache/get`, `GET /cache/meta`, `POST /cache/clear`
- `POST /sparql/query` — body `{ "query": "SELECT ..." }`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/`. The dev server proxies `/api/*` to `http://localhost:5174`.

### Environment (backend)

| Variable | Purpose |
|----------|---------|
| `RDF_CACHE_URL` | Base URL of the Rust service (default `http://127.0.0.1:8181`). |

### Environment (Rust service)

See `rdf-cache-service/.env.example` (`RDF_CACHE_HOST`, `RDF_CACHE_PORT`, `RUST_LOG`).

## Monorepo scripts (optional)

From repo root:

```bash
npm install
npm run dev:backend    # backend only
npm run dev:frontend   # frontend only
```

## OntoX SDK / CLI (local)

Scaffold under `packages/`:

- `packages/ontox-js` — JavaScript SDK (`OntoXClient`)
- `packages/ontox-cli` — CLI (`ontox`)
- `packages/ontox-py` — Python SDK

### JS (Node) quick start

```bash
npm install
node -e "import { OntoXClient } from 'ontox'; const client = new OntoXClient({ baseUrl: 'http://localhost:5174' }); client.entities.list().then(console.log)"
```

### CLI quick start

```bash
npm install
npm --workspace packages/ontox-cli exec -- ontox entities list --json
```

### Python quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e packages/ontox-py
python -c "from ontox import OntoXClient; print(OntoXClient(base_url='http://localhost:5174').entities.list())"
```
