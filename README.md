# Ontology Platform (CRM → OWL/RDF)

This MVP provides:

- CRM tables and CRUD UI: Accounts, Contacts, Opportunities, Activities, Products, Orders, Order items
- A relationship designer (table-to-table join rules)
- RDF/OWL export as Turtle
- A schema relationship graph view

## Run locally

In one terminal:

```bash
cd backend
npm run dev
```

In another terminal:

```bash
cd frontend
npm run dev
```

Then open `http://127.0.0.1:5173/`.

## Notes

- The backend uses SQLite at `backend/data/ontology-platform.sqlite`.
- The frontend proxies `/api/*` to the backend at `http://localhost:5174`.

## OntoX SDK / CLI (local)

This repo includes a minimal SDK + CLI scaffold under `packages/`:

- `packages/ontox-js`: JavaScript SDK (import `OntoXClient`)
- `packages/ontox-cli`: CLI (binary: `ontox`)
- `packages/ontox-py`: Python SDK (import `OntoXClient`)

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

