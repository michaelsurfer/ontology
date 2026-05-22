import type { Express } from 'express';
import { deleteLandingZoneRecord, listLandingZoneRecords } from './workflow/database.js';

// Register landing zone API routes on the dashboard server.
export function registerLandingZoneRoutes(application: Express): void {
  application.get('/api/landing-zone', (_request, response) => {
    try {
      const records = listLandingZoneRecords().map((row) => ({
        id: row.id,
        workflow_id: row.workflow_id,
        workflow_name: row.workflow_name,
        run_id: row.run_id,
        record_index: row.record_index,
        reason: row.reason,
        payload: JSON.parse(row.payload_json),
        created_at_ms: row.created_at_ms,
      }));
      response.json(records);
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });

  application.delete('/api/landing-zone/:recordId', (request, response) => {
    try {
      const recordId = parseRecordId(request.params.recordId);
      deleteLandingZoneRecord(recordId);
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({ error: formatRouteError(error) });
    }
  });
}

// Parse landing zone record id from the URL.
function parseRecordId(rawValue: string): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Invalid landing zone record id');
  }
  return parsed;
}

// Format unknown route errors.
function formatRouteError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
