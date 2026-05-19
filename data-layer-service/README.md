# Data Layer Service

Rust HTTP API backed by **LMDB** for entity schemas, entity row data, and relationship links (junction-style rows identified by entity/row ids).

Mirrors core concepts from the Node backend (`custom_entities`, `customEntityCrud`, `relationshipsStore`) with a simpler storage model: JSON documents in LMDB instead of dynamic SQLite tables.

## Run locally

```bash
cd data-layer-service
cp .env.example .env   # optional
cargo run
```

Default listen address: `http://127.0.0.1:8182`  
Default database directory: `./data/data-layer-lmdb` (LMDB environment folder)

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_LAYER_HOST` | `127.0.0.1` | Bind host |
| `DATA_LAYER_PORT` | `8182` | Bind port |
| `DATA_LAYER_DB_PATH` | `./data/data-layer-lmdb` | LMDB environment directory |
| `DATA_LAYER_BASE_IRI` | `http://example.com/context#` | Ontology + property IRI prefix |
| `DATA_LAYER_RESOURCE_IRI_PREFIX` | `http://example.com/resource/` | Instance resource URIs |
| `RUST_LOG` | — | Log filter (e.g. `info`) |

## API

### Health

- `GET /health` → `{ "ok": true }`

### RDF Turtle export

- `POST /rdf/turtle` — returns `text/turtle; charset=utf-8`  
  Body (JSON):
  - **`"entity_ids": "*"`** — export all entities, rows, and relationships in LMDB
  - **`"entity_ids": [1, 2, ...]`** — export those entities **plus every entity linked to them through stored relationships** (e.g. request only `company` → also includes `employee` and all `employed_by` / similar links), with OWL classes, row data, and row-to-row relationship triples

```bash
# Full graph
curl -s -X POST http://127.0.0.1:8182/rdf/turtle \
  -H 'Content-Type: application/json' \
  -d '{"entity_ids":"*"}'

# By numeric id (must match LMDB — run GET /entities first)
curl -s -X POST http://127.0.0.1:8182/rdf/turtle \
  -H 'Content-Type: application/json' \
  -d '{"entity_ids":[4]}'

# By entity name (pulls in relationship-linked entities too)
curl -s -X POST http://127.0.0.1:8182/rdf/turtle \
  -H 'Content-Type: application/json' \
  -d '{"entity_names":["corporation"]}'
```

Use the URL **without** a trailing slash (`/rdf/turtle`, not `/rdf/turtle/`).

**Tip:** Relationships are stored between specific entity ids. If you have both `company` and `corporation` entities, links created by the seed script use `employee` → `corporation`, not `company`. Check `GET /entities` and `GET /relationships` before exporting. The Turtle file starts with `# RDF export —` comments listing what was included.

### Entity structure (schema)

Each entity has an auto-increment `id` and a unique `name` (`^[a-z][a-z0-9_]*$`).

- `POST /entities` — create entity + fields  
  Body: `{ "name": "person", "display_name": "Person", "fields": [{ "field_name": "email", "field_type": "TEXT", "is_required": true }] }`
- `PUT /entities/:entity_id` — update name, display name, and/or fields  
  Body: partial `{ "name", "display_name", "fields" }`
- `GET /entities` — list `{ id, name }[]`
- `GET /entities/:entity_id` — full entity definition
- `DELETE /entities/:entity_id` — delete entity, all rows, and related relationships

Field types: `TEXT`, `INTEGER`, `REAL` (same allowlist as the JS backend).

### Entity data (rows)

- `GET /entities/:entity_id/data` — all rows for the entity
- `POST /entities/:entity_id/data` — create row (`values` object keyed by field name)
- `PUT /entities/:entity_id/data/:row_id` — update row
- `DELETE /entities/:entity_id/data/:row_id` — delete row and touching link records

Rows have auto-increment `id` per entity.

### Entity relationships (schema — no row data)

Defines **how two entity types are related** (like the Node `relationship_definitions` concept). No row ids.

- `POST /entity-relationships`  
  Body: `{ "relationship_name": "works_at", "subject_entity_id": 3, "object_entity_id": 4 }`
- `GET /entity-relationships` — list all definitions
- `GET /entity-relationships/:entity_relationship_id` — fetch one
- `PUT /entity-relationships/:entity_relationship_id` — partial update
- `DELETE /entity-relationships/:entity_relationship_id` — delete schema relationship

Duplicate `(subject_entity_id, object_entity_id, relationship_name)` is rejected.

RDF Turtle export emits `owl:ObjectProperty` with `rdfs:domain` / `rdfs:range` for these even when no row links exist yet.

### Relationship links (instance data)

Links **specific rows** between two entities:

- `POST /relationships`  
  Body: `{ "relationship_name", "subject_entity_id", "object_entity_id", "subject_row_id", "object_row_id" }`
- `PUT /relationships/:relationship_id` — partial update of the same fields
- `GET /relationships` — list all row-level link records
- `PUT /relationships/:relationship_id` — partial update
- `DELETE /relationships/:relationship_id` — delete row link

## Example flow

```bash
# Create entity
curl -s -X POST http://127.0.0.1:8182/entities \
  -H 'Content-Type: application/json' \
  -d '{"name":"person","fields":[{"field_name":"email","field_type":"TEXT"}]}'

# Add row
curl -s -X POST http://127.0.0.1:8182/entities/1/data \
  -H 'Content-Type: application/json' \
  -d '{"values":{"email":"a@example.com"}}'

# List entities
curl -s http://127.0.0.1:8182/entities

# List entity data
curl -s http://127.0.0.1:8182/entities/1/data

# Define entity relationship (schema)
curl -s -X POST http://127.0.0.1:8182/entity-relationships \
  -H 'Content-Type: application/json' \
  -d '{"relationship_name":"works_with","subject_entity_id":1,"object_entity_id":2}'

# Link rows (instance data)
curl -s -X POST http://127.0.0.1:8182/relationships \
  -H 'Content-Type: application/json' \
  -d '{"relationship_name":"works_with","subject_entity_id":1,"object_entity_id":2,"subject_row_id":1,"object_row_id":1}'

curl -s http://127.0.0.1:8182/entity-relationships
curl -s http://127.0.0.1:8182/relationships
```
