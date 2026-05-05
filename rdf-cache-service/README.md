# RDF Cache Service (Rust)

Standalone Rust backend that caches Turtle RDF in memory.

This service caches Turtle RDF in memory and can execute SPARQL SELECT queries on cached data.

Your JS backend can:

1. Build Turtle as usual.
2. POST Turtle to this service (`/cache/load`).
3. Call Rust SPARQL endpoint (`/sparql/query`) to execute queries.

## Endpoints

- `GET /health`
- `POST /cache/load` - load Turtle into cache
- `GET /cache/get` - get full cached Turtle
- `GET /cache/meta` - get version/size metadata only
- `POST /cache/clear` - clear cache
- `POST /sparql/query` - run SPARQL SELECT on cached Turtle

## Request / Response

### POST `/cache/load`

```json
{
  "turtle": "@prefix ex: <http://example.com/> . ex:a ex:knows ex:b .",
  "replace": true
}
```

`replace=true` overwrites cache. `replace=false` appends Turtle text.

### GET `/cache/get`

```json
{
  "ok": true,
  "version": 3,
  "turtle": "...full turtle text...",
  "turtle_bytes": 12452,
  "updated_at_ms": 1746450000000
}
```

### POST `/sparql/query`

```json
{
  "query": "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50"
}
```

Response shape:

```json
{
  "ok": true,
  "version": 3,
  "variables": ["s", "p", "o"],
  "rows": [
    { "s": "http://example.com/a", "p": "http://example.com/knows", "o": "http://example.com/b" }
  ],
  "execution_time_ms": 5
}
```

## Local run

1. Install Rust toolchain.
2. Copy env file:
   - `cp .env.example .env`
3. Start service:
   - `cargo run`

Default bind: `127.0.0.1:8181`

## Integration idea for JS backend

- On data-changing endpoints in JS:
  - rebuild Turtle once
  - call `POST http://127.0.0.1:8181/cache/load` with `replace=true`
- On SPARQL endpoint in JS:
  - call `POST http://127.0.0.1:8181/sparql/query` with query text
  - pass through returned `variables` + `rows` to existing frontend response

This gives "build once, query many times" behavior with SPARQL execution handled in Rust.
