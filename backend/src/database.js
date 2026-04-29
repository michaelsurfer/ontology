import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const databaseFilePath = path.join(process.cwd(), 'data', 'ontology-platform.sqlite')

let databaseInstance = null

/* Create and/or return the singleton SQLite database connection. */
export function getDatabase() {
  if (databaseInstance) {
    return databaseInstance
  }

  fs.mkdirSync(path.dirname(databaseFilePath), { recursive: true })

  databaseInstance = new Database(databaseFilePath)
  databaseInstance.pragma('foreign_keys = ON')

  return databaseInstance
}

/* Create all required tables and seed minimal default ontology metadata. */
export function initializeDatabase() {
  const database = getDatabase()

  // Remove legacy builtin CRM tables if they exist AND are not registered as custom entities.
  // This project now relies on user-defined/custom entities instead of preloaded CRM tables.
  const legacyBuiltinTableNames = [
    'accounts',
    'contacts',
    'opportunities',
    'activities',
    'products',
    'orders',
    'order_items',
  ]

  const customEntityNameRows = database.prepare('SELECT entity_name FROM custom_entities').all()
  const customEntityNames = new Set(customEntityNameRows.map((row) => row.entity_name))

  database.exec('PRAGMA foreign_keys = OFF;')
  for (const tableName of legacyBuiltinTableNames) {
    if (customEntityNames.has(tableName)) {
      continue
    }
    database.exec(`DROP TABLE IF EXISTS "${tableName}"`)
  }
  database.exec('PRAGMA foreign_keys = ON;')

  database.exec(`
    -- Ontology / mapping metadata
    CREATE TABLE IF NOT EXISTS ontology_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_iri TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entity_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_name TEXT NOT NULL UNIQUE,
      class_iri TEXT NOT NULL,
      subject_iri_template TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS property_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      property_iri TEXT NOT NULL,
      datatype_iri TEXT,
      language_tag TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(entity_name, column_name)
    );

    CREATE TABLE IF NOT EXISTS relationship_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relationship_name TEXT NOT NULL,
      subject_entity TEXT NOT NULL,
      subject_column TEXT NOT NULL,
      predicate_iri TEXT NOT NULL,
      object_entity TEXT NOT NULL,
      object_column TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- SHACL rules/constraints (ontology rules)
    CREATE TABLE IF NOT EXISTS ontology_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      target_entity TEXT NOT NULL,
      rule_kind TEXT NOT NULL,
      property_iri TEXT NOT NULL,
      datatype_iri TEXT,
      pattern TEXT,
      allowed_values_json TEXT,
      min_count INTEGER,
      max_count INTEGER,
      message TEXT,
      severity_iri TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Custom entities (Option B: real SQL tables created dynamically)
    CREATE TABLE IF NOT EXISTS custom_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_entity_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custom_entity_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(custom_entity_id, field_name),
      FOREIGN KEY (custom_entity_id) REFERENCES custom_entities(id) ON DELETE CASCADE
    );

    -- Ingest events (webhook / SDK front door)
    CREATE TABLE IF NOT EXISTS ingest_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      external_id TEXT,
      occurred_at TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Map incoming entity_type to an existing entity/table name once published
    CREATE TABLE IF NOT EXISTS ingest_entity_type_mappings (
      entity_type TEXT PRIMARY KEY,
      target_entity_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Draft ontology suggestions generated from ingested data (review before apply)
    CREATE TABLE IF NOT EXISTS ontology_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | rejected | published
      title TEXT NOT NULL,
      confidence REAL,
      fingerprint TEXT,
      proposal_json TEXT NOT NULL,
      evidence_json TEXT,
      ai_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Lightweight "migration" for older DBs where custom_entity_fields didn't have is_active yet
  const customFieldColumns = database.prepare("PRAGMA table_info('custom_entity_fields')").all()
  const customFieldColumnNames = new Set(customFieldColumns.map((row) => row.name))
  if (!customFieldColumnNames.has('is_active')) {
    database.exec('ALTER TABLE custom_entity_fields ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')
  }

  // Lightweight "migration" for older DBs where ontology_suggestions didn't have fingerprint yet
  const suggestionColumns = database.prepare("PRAGMA table_info('ontology_suggestions')").all()
  const suggestionColumnNames = new Set(suggestionColumns.map((row) => row.name))
  if (!suggestionColumnNames.has('fingerprint')) {
    database.exec('ALTER TABLE ontology_suggestions ADD COLUMN fingerprint TEXT')
  }

  // Ensure a unique index exists for suggestion fingerprints (dedupe)
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ontology_suggestions_fingerprint_unique
    ON ontology_suggestions (fingerprint)
    WHERE fingerprint IS NOT NULL;
  `)

  const baseOntologyIri = 'http://example.com/context#'

  const settingsRow = database
    .prepare('SELECT id, base_iri FROM ontology_settings WHERE id = 1')
    .get()

  const isFirstRun = !settingsRow
  if (!settingsRow) {
    database
      .prepare('INSERT INTO ontology_settings (id, base_iri) VALUES (1, ?)')
      .run(baseOntologyIri)
  }

  // No default entity mappings, property mappings, relationships, or sample CRM rows are seeded.
}

