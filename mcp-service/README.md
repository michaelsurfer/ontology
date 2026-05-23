# AnythingGraph MCP Service

TypeScript [Model Context Protocol](https://modelcontextprotocol.io/) server (stdio) for external AI agents (Cursor, Claude Desktop, etc.). Talks directly to **data-layer-service** and **rdf-cache-service** — not the dashboard UI.

## Prerequisites

1. **data-layer-service** on port `8182`
2. **rdf-cache-service** on port `8181`

```bash
cd data-layer-service && cargo run
cd rdf-cache-service && cargo run
```

## Install and run

```bash
cd mcp-service
npm install
npm run build
npm start
```

Development (stdio, for MCP host to spawn):

```bash
npm run dev
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_LAYER_URL` | `http://127.0.0.1:8182` | LMDB entity/relationship API |
| `RDF_CACHE_URL` | `http://127.0.0.1:8181` | Turtle cache + SPARQL |

Copy `.env.example` if you run with custom URLs (MCP hosts pass `env` in config).

## Tools

| Tool | Description |
|------|-------------|
| `health_check` | Ping data-layer + rdf-cache |
| `list_entities` | Entity id/name list |
| `get_entity` | Full entity schema + fields |
| `list_entity_rows` | Rows for one entity |
| `create_entity_row` | Insert row (`values_json` string) |
| `list_entity_relationships` | Schema-level entity links |
| `list_row_relationships` | Row-to-row instance links |
| `export_turtle` | RDF Turtle from data-layer (no cache load) |
| `sync_rdf_cache` | Export Turtle → `POST /cache/load` |
| `run_sparql` | SPARQL SELECT (syncs cache first by default) |

## Resource

- `anythinggraph://schema-summary` — JSON snapshot of entities and relationships

## Cursor configuration

Add to Cursor **Settings → MCP** (or project `.cursor/mcp.json`), using the **built** entrypoint:

```json
{
  "mcpServers": {
    "anythinggraph": {
      "command": "node",
      "args": ["/absolute/path/to/ontology/mcp-service/dist/index.js"],
      "env": {
        "DATA_LAYER_URL": "http://127.0.0.1:8182",
        "RDF_CACHE_URL": "http://127.0.0.1:8181"
      }
    }
  }
}
```

For development without a build step:

```json
{
  "mcpServers": {
    "anythinggraph": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/ontology/mcp-service/src/index.ts"],
      "env": {
        "DATA_LAYER_URL": "http://127.0.0.1:8182",
        "RDF_CACHE_URL": "http://127.0.0.1:8181"
      }
    }
  }
}
```

Replace `/absolute/path/to/ontology` with your repo path (folder name may still be `ontology` on disk).

## Typical agent workflow

1. `health_check`
2. `list_entities` or read resource `anythinggraph://schema-summary`
3. Mutate data via `create_entity_row` (etc.) if needed
4. `sync_rdf_cache` or `run_sparql` (which syncs by default)
5. `run_sparql` with `sync_cache_before: false` for follow-up queries on unchanged data
