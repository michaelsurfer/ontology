# AnythingGraph

AnythingGraph helps teams turn scattered business information—documents, spreadsheets, CRM exports, API payloads—into **connected records** they can explore, automate, and question without rebuilding everything in one monolithic database.

## Product overview

Most organizations already have the data they need; it is just spread across tools, folders, and teams. AnythingGraph is a **context layer**: you define the record types and relationships that match how your business actually works, bring data in through uploads or webhooks, and see how accounts, people, orders, and documents link together on a visual graph.

You stay in control of the model. Install a starter **playbook** (for example CRM or invoice extraction), adjust fields and links, then run **workflows** when new data arrives. Items that need a human review land in a **landing zone** instead of silently failing.

## Who it is for

- **Operations and business users** who need structured record types (forms), relationships, and light automation without a multi-month IT project
- **Data and integration owners** who want a durable, queryable picture of entities and how they connect across sources
- **Developers and AI assistants** that need reliable APIs and MCP access to read and write the same graph agents and people see in the UI

## Problems it addresses

| Challenge | How AnythingGraph helps |
|-----------|-------------------------|
| Data stuck in PDFs, email, and spreadsheets | Ingest and map into shared **record types** with validation |
| “How is this customer related to that order?” is hard to answer | Model **relationships** between records and explore them visually |
| Every new source needs a custom script | **Playbooks** and **workflows** package repeatable ingest pipelines |
| Business questions wait on engineering for SQL | **Query Studio** (when RDF/SPARQL is enabled) supports natural-language exploration over the graph |

## What you can do

- **Define record types** — Schemas for invoices, accounts, employees, products, or anything specific to your domain.
- **Link records** — Connect rows across types (for example contact → account → opportunity) so navigation follows real business structure.
- **Use playbooks** — Install starter packs with record types, relationships, and workflows you can customize.
- **Ingest documents and files** — Upload or send webhooks (JSON, CSV, PDF, and more); workflows create or update rows and route exceptions to review.
- **Automate with workflows** — Trigger on upload or HTTP, validate and map fields, create relationships, and handle failures explicitly.
- **Explore the graph** — See how types and instances connect—useful for onboarding, audits, and data-quality checks.
- **Work with AI tools** — MCP integration lets agents list entities, rows, and relationships against the same data the dashboard uses.

## Typical use cases

1. **Invoice and document intake** — Pull vendor, amount, and dates from invoices into structured records; link to vendors or cost centers.
2. **Lightweight CRM** — Accounts, contacts, leads, and opportunities with clear links and ingest from spreadsheets or external systems.
3. **Operational hub** — A shared graph of corporations, people, products, or projects that other tools and automations reference.
4. **Integration landing** — Normalize webhook payloads through workflows before records spread to downstream systems.

## Playbook catalog (dashboard)

Install starter packs from **Playbooks** in the dashboard (`dashboard/backend/src/playbook/playbooks/`):

| Section | Playbooks |
|---------|-----------|
| Start here | Organizational graph, CRM relationship graph |
| Integrate data | Reference data alignment, Data quality stewardship, Identity golden record |
| Operations | Invoice records (structured), Procure to pay, Support case management |
| AI & documents | Document registry |
| Advanced | Product composition |

Each playbook includes record types, schema relationships, an ingest workflow, and MCP instructions (`playbook id` in the pack).

**In brief (technical):** custom entities, OWL-style mappings, relationships (including link tables), RDF Turtle export, SHACL rules, and **Query Studio** (natural language → SPARQL → results).

## Architecture (high level)

- **Node backend** (`backend/`): Express API, SQLite, RDF export (`createRdfTurtleExport`), schema graph for the UI, AI chat / planning. After writes that affect the graph, it **refreshes** the Rust cache (best effort).
- **Rust services** (`core-services/`): Cargo workspace with LMDB data layer, RDF cache, and shared policy engine
  - **data-layer-service** — entities, rows, relationships, Turtle export (port `8182`)
  - **rdf-cache-service** — in-memory Turtle cache plus **SPARQL SELECT** via **Oxigraph** (port `8181`)
  - **policy-engine** — shared OSS role and field-policy library (`core-services/crates/policy-engine`)
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
cd core-services/rdf-cache-service
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

See `core-services/rdf-cache-service/.env.example` (`RDF_CACHE_HOST`, `RDF_CACHE_PORT`, `RUST_LOG`).

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
