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
| `RUST_LOG` | — | Log filter (e.g. `info`) |

## API

### Health

- `GET /health` → `{ "ok": true }`

### Entity structure (schema)

Each entity has an auto-increment `id` and a unique `name` (`^[a-z][a-z0-9_]*$`).

- `POST /entities` — create entity + fields  
  Body: `{ "name": "person", "display_name": "Person", "fields": [{ "field_name": "email", "field_type": "TEXT", "is_required": true }] }`
- `PUT /entities/:entity_id` — update name, display name, and/or fields  
  Body: partial `{ "name", "display_name", "fields" }`
- `GET /entities` — list `{ id, name }[]`
- `GET /entities/:entity_id` — full entity definition

Field types: `TEXT`, `INTEGER`, `REAL` (same allowlist as the JS backend).

### Entity data (rows)

- `GET /entities/:entity_id/data` — all rows for the entity
- `POST /entities/:entity_id/data` — create row (`values` object keyed by field name)
- `PUT /entities/:entity_id/data/:row_id` — update row

Rows have auto-increment `id` per entity.

### Relationships (link records)

Each relationship has an auto-increment `id`, a required `relationship_name`, and links two rows by id:

- `POST /relationships`  
  Body: `{ "relationship_name", "subject_entity_id", "object_entity_id", "subject_row_id", "object_row_id" }`
- `PUT /relationships/:relationship_id` — partial update of the same fields
- `GET /relationships` — list all relationship records

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

# Create relationship (after a second entity + row exist)
curl -s -X POST http://127.0.0.1:8182/relationships \
  -H 'Content-Type: application/json' \
  -d '{"relationship_name":"works_with","subject_entity_id":1,"object_entity_id":2,"subject_row_id":1,"object_row_id":1}'

curl -s http://127.0.0.1:8182/relationships
```
