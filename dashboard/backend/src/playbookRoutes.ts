import type { Express } from 'express';
import { getPlaybookDetail } from './playbook/getPlaybookDetail.js';
import { installPlaybook } from './playbook/installPlaybook.js';
import { normalizePlaybookId } from './playbook/listPlaybooks.js';
import { listPlaybookSummariesWithStatus } from './playbook/playbookInstallStatus.js';
import { uninstallPlaybook } from './playbook/uninstallPlaybook.js';

// Register playbook list, install, and uninstall routes.
export function registerPlaybookRoutes(application: Express): void {
  application.get('/api/playbooks', async (_request, response) => {
    try {
      response.json(await listPlaybookSummariesWithStatus());
    } catch (error) {
      response.status(400).json({ error: formatPlaybookRouteError(error) });
    }
  });

  application.get('/api/playbooks/:playbookId', async (request, response) => {
    try {
      const playbookId = normalizePlaybookId(readRouteParam(request.params.playbookId));
      response.json(await getPlaybookDetail(playbookId));
    } catch (error) {
      response.status(400).json({ error: formatPlaybookRouteError(error) });
    }
  });

  application.post('/api/playbooks/:playbookId/install', async (request, response) => {
    try {
      const playbookId = normalizePlaybookId(readRouteParam(request.params.playbookId));
      const installResult = await installPlaybook(playbookId);
      response.status(201).json(installResult);
    } catch (error) {
      response.status(400).json({ error: formatPlaybookRouteError(error) });
    }
  });

  application.delete('/api/playbooks/:playbookId/install', async (request, response) => {
    try {
      const playbookId = normalizePlaybookId(readRouteParam(request.params.playbookId));
      const uninstallResult = await uninstallPlaybook(playbookId);
      response.json(uninstallResult);
    } catch (error) {
      response.status(400).json({ error: formatPlaybookRouteError(error) });
    }
  });
}

// Read a single Express route parameter value.
function readRouteParam(rawValue: string | string[]): string {
  if (Array.isArray(rawValue)) {
    return rawValue[0] || '';
  }
  return rawValue || '';
}

// Format unknown route errors for JSON responses.
function formatPlaybookRouteError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
