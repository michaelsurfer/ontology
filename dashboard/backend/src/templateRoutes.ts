import type { Express } from 'express';
import { getTemplateDetail } from './template/getTemplateDetail.js';
import { installTemplate } from './template/installTemplate.js';
import { normalizeTemplateId } from './template/listTemplates.js';
import { listTemplateSummariesWithStatus } from './template/templateInstallStatus.js';
import { uninstallTemplate } from './template/uninstallTemplate.js';

// Register template list, install, and uninstall routes.
export function registerTemplateRoutes(application: Express): void {
  application.get('/api/templates', async (_request, response) => {
    try {
      response.json(await listTemplateSummariesWithStatus());
    } catch (error) {
      response.status(400).json({ error: formatTemplateRouteError(error) });
    }
  });

  application.get('/api/templates/:templateId', async (request, response) => {
    try {
      const templateId = normalizeTemplateId(readRouteParam(request.params.templateId));
      response.json(await getTemplateDetail(templateId));
    } catch (error) {
      response.status(400).json({ error: formatTemplateRouteError(error) });
    }
  });

  application.post('/api/templates/:templateId/install', async (request, response) => {
    try {
      const templateId = normalizeTemplateId(readRouteParam(request.params.templateId));
      const installResult = await installTemplate(templateId);
      response.status(201).json(installResult);
    } catch (error) {
      response.status(400).json({ error: formatTemplateRouteError(error) });
    }
  });

  application.delete('/api/templates/:templateId/install', async (request, response) => {
    try {
      const templateId = normalizeTemplateId(readRouteParam(request.params.templateId));
      const uninstallResult = await uninstallTemplate(templateId);
      response.json(uninstallResult);
    } catch (error) {
      response.status(400).json({ error: formatTemplateRouteError(error) });
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
function formatTemplateRouteError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
