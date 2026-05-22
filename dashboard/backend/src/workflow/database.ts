import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { WorkflowGraph, WorkflowRecord, WorkflowRunRecord } from './types.js';

const defaultDatabasePath = path.join(process.cwd(), 'data', 'dashboard-workflows.sqlite');

let databaseInstance: Database.Database | null = null;

// Open SQLite database for workflow definitions and run history.
export function getWorkflowDatabase(): Database.Database {
  if (databaseInstance) {
    return databaseInstance;
  }

  const databasePath = process.env.DASHBOARD_WORKFLOW_DB_PATH || defaultDatabasePath;
  const databaseDirectory = path.dirname(databasePath);
  fs.mkdirSync(databaseDirectory, { recursive: true });

  databaseInstance = new Database(databasePath);
  databaseInstance.pragma('journal_mode = WAL');
  initializeWorkflowTables(databaseInstance);
  return databaseInstance;
}

// Create workflow tables if they do not exist yet.
function initializeWorkflowTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      graph_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      dry_run INTEGER NOT NULL DEFAULT 0,
      input_json TEXT NOT NULL,
      result_json TEXT NOT NULL DEFAULT '{}',
      started_at_ms INTEGER NOT NULL,
      finished_at_ms INTEGER,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE TABLE IF NOT EXISTS workflow_fallback_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      record_index INTEGER NOT NULL,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
    );

    CREATE TABLE IF NOT EXISTS landing_zone_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER,
      workflow_name TEXT NOT NULL DEFAULT '',
      run_id INTEGER,
      record_index INTEGER NOT NULL,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );
  `);
}

export type LandingZoneRecord = {
  id: number;
  workflow_id: number | null;
  workflow_name: string;
  run_id: number | null;
  record_index: number;
  reason: string;
  payload_json: string;
  created_at_ms: number;
};

// List all saved workflows ordered by most recently updated.
export function listWorkflows(): WorkflowRecord[] {
  const database = getWorkflowDatabase();
  return database
    .prepare(
      `SELECT id, name, description, graph_json, created_at_ms, updated_at_ms
       FROM workflows
       ORDER BY updated_at_ms DESC`,
    )
    .all() as WorkflowRecord[];
}

// Fetch one workflow by id.
export function getWorkflowById(workflowId: number): WorkflowRecord | null {
  const database = getWorkflowDatabase();
  const row = database
    .prepare(
      `SELECT id, name, description, graph_json, created_at_ms, updated_at_ms
       FROM workflows WHERE id = ?`,
    )
    .get(workflowId) as WorkflowRecord | undefined;
  return row || null;
}

// Insert a new workflow definition.
export function createWorkflowRecord(options: {
  name: string;
  description: string;
  graph: WorkflowGraph;
}): WorkflowRecord {
  const database = getWorkflowDatabase();
  const timestamp = Date.now();
  const insertResult = database
    .prepare(
      `INSERT INTO workflows (name, description, graph_json, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(options.name, options.description, JSON.stringify(options.graph), timestamp, timestamp);

  const workflowId = Number(insertResult.lastInsertRowid);
  const created = getWorkflowById(workflowId);
  if (!created) {
    throw new Error('Failed to create workflow');
  }
  return created;
}

// Update workflow metadata and graph.
export function updateWorkflowRecord(
  workflowId: number,
  options: { name: string; description: string; graph: WorkflowGraph },
): WorkflowRecord {
  const database = getWorkflowDatabase();
  const timestamp = Date.now();
  database
    .prepare(
      `UPDATE workflows
       SET name = ?, description = ?, graph_json = ?, updated_at_ms = ?
       WHERE id = ?`,
    )
    .run(options.name, options.description, JSON.stringify(options.graph), timestamp, workflowId);

  const updated = getWorkflowById(workflowId);
  if (!updated) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }
  return updated;
}

// Delete a workflow and its runs.
export function deleteWorkflowRecord(workflowId: number): void {
  const database = getWorkflowDatabase();
  const runIds = database
    .prepare(`SELECT id FROM workflow_runs WHERE workflow_id = ?`)
    .all(workflowId) as Array<{ id: number }>;

  const deleteFallback = database.prepare(`DELETE FROM workflow_fallback_records WHERE run_id = ?`);
  const deleteRun = database.prepare(`DELETE FROM workflow_runs WHERE id = ?`);

  for (const runRow of runIds) {
    deleteFallback.run(runRow.id);
    deleteRun.run(runRow.id);
  }

  database.prepare(`DELETE FROM workflows WHERE id = ?`).run(workflowId);
}

// Create a workflow run row at start of execution.
export function createWorkflowRun(options: {
  workflowId: number;
  dryRun: boolean;
  inputJson: string;
}): WorkflowRunRecord {
  const database = getWorkflowDatabase();
  const timestamp = Date.now();
  const insertResult = database
    .prepare(
      `INSERT INTO workflow_runs (workflow_id, status, dry_run, input_json, result_json, started_at_ms)
       VALUES (?, 'running', ?, ?, '{}', ?)`,
    )
    .run(options.workflowId, options.dryRun ? 1 : 0, options.inputJson, timestamp);

  const runId = Number(insertResult.lastInsertRowid);
  const runRow = database
    .prepare(
      `SELECT id, workflow_id, status, dry_run, input_json, result_json, started_at_ms, finished_at_ms
       FROM workflow_runs WHERE id = ?`,
    )
    .get(runId) as WorkflowRunRecord;

  return runRow;
}

// Mark workflow run complete with result payload.
export function finishWorkflowRun(
  runId: number,
  status: string,
  resultJson: string,
): void {
  const database = getWorkflowDatabase();
  database
    .prepare(
      `UPDATE workflow_runs
       SET status = ?, result_json = ?, finished_at_ms = ?
       WHERE id = ?`,
    )
    .run(status, resultJson, Date.now(), runId);
}

// Persist fallback payloads for a workflow run.
export function insertFallbackRecords(
  runId: number,
  fallbackRecords: Array<{ recordIndex: number; reason: string; payload: Record<string, unknown> }>,
): void {
  const database = getWorkflowDatabase();
  const insertStatement = database.prepare(
    `INSERT INTO workflow_fallback_records (run_id, record_index, reason, payload_json, created_at_ms)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const timestamp = Date.now();
  for (const fallbackRecord of fallbackRecords) {
    insertStatement.run(
      runId,
      fallbackRecord.recordIndex,
      fallbackRecord.reason,
      JSON.stringify(fallbackRecord.payload),
      timestamp,
    );
  }
}

// List workflow runs for one workflow.
export function listWorkflowRuns(workflowId: number): WorkflowRunRecord[] {
  const database = getWorkflowDatabase();
  return database
    .prepare(
      `SELECT id, workflow_id, status, dry_run, input_json, result_json, started_at_ms, finished_at_ms
       FROM workflow_runs
       WHERE workflow_id = ?
       ORDER BY started_at_ms DESC`,
    )
    .all(workflowId) as WorkflowRunRecord[];
}

// Save records sent to the landing zone from a workflow fallback node.
export function insertLandingZoneRecords(options: {
  workflowId: number;
  workflowName: string;
  runId: number;
  records: Array<{ recordIndex: number; reason: string; payload: Record<string, unknown> }>;
}): number {
  const database = getWorkflowDatabase();
  const insertStatement = database.prepare(
    `INSERT INTO landing_zone_records
     (workflow_id, workflow_name, run_id, record_index, reason, payload_json, created_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const timestamp = Date.now();
  let insertedCount = 0;

  for (const record of options.records) {
    insertStatement.run(
      options.workflowId,
      options.workflowName,
      options.runId,
      record.recordIndex,
      record.reason,
      JSON.stringify(record.payload),
      timestamp,
    );
    insertedCount += 1;
  }

  return insertedCount;
}

// List all landing zone records (newest first).
export function listLandingZoneRecords(): LandingZoneRecord[] {
  const database = getWorkflowDatabase();
  return database
    .prepare(
      `SELECT id, workflow_id, workflow_name, run_id, record_index, reason, payload_json, created_at_ms
       FROM landing_zone_records
       ORDER BY created_at_ms DESC, id DESC`,
    )
    .all() as LandingZoneRecord[];
}

// Delete one landing zone record by id.
export function deleteLandingZoneRecord(landingZoneRecordId: number): void {
  const database = getWorkflowDatabase();
  database.prepare(`DELETE FROM landing_zone_records WHERE id = ?`).run(landingZoneRecordId);
}

// List fallback rows for a workflow run.
export function listFallbackRecordsForRun(runId: number) {
  const database = getWorkflowDatabase();
  return database
    .prepare(
      `SELECT id, run_id, record_index, reason, payload_json, created_at_ms
       FROM workflow_fallback_records
       WHERE run_id = ?
       ORDER BY record_index ASC`,
    )
    .all(runId) as Array<{
    id: number;
    run_id: number;
    record_index: number;
    reason: string;
    payload_json: string;
    created_at_ms: number;
  }>;
}
