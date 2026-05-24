import type { Request } from 'express';
import type { Express } from 'express';
import multer from 'multer';
import { installTemplate } from './template/installTemplate.js';
import { normalizeTemplateId } from './template/listTemplates.js';
import { processTemplateDocument } from './template/processTemplateDocument.js';
import { listTemplateSummariesWithStatus } from './template/templateInstallStatus.js';
import { uninstallTemplate } from './template/uninstallTemplate.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

// Register template list, install, uninstall, and document processing routes.
export function registerTemplateRoutes(application: Express): void {
  application.get('/api/templates', async (_request, response) => {
    try {
      response.json(await listTemplateSummariesWithStatus());
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

  application.post(
    '/api/templates/:templateId/process-document',
    upload.single('file'),
    async (request, response) => {
      try {
        const templateId = normalizeTemplateId(readRouteParam(request.params.templateId));
        const uploadedFile = readUploadedFile(request);
        const dryRun = String(request.body?.dry_run || '').toLowerCase() === 'true';

        const result = await processTemplateDocument({
          templateId,
          fileName: uploadedFile.originalname,
          fileBuffer: uploadedFile.buffer,
          mimeType: uploadedFile.mimetype,
          dryRun,
        });

        response.json(result);
      } catch (error) {
        response.status(400).json({ error: formatTemplateRouteError(error) });
      }
    },
  );
}

// Read a single Express route parameter value.
function readRouteParam(rawValue: string | string[]): string {
  if (Array.isArray(rawValue)) {
    return rawValue[0] || '';
  }
  return rawValue || '';
}

// Read the multer file from the request or throw a clear error.
function readUploadedFile(request: Request): Express.Multer.File {
  const uploadedFile = request.file;
  if (!uploadedFile || !uploadedFile.buffer || uploadedFile.buffer.length === 0) {
    throw new Error('file is required (multipart field name: file)');
  }
  return uploadedFile;
}

// Format unknown route errors for JSON responses.
function formatTemplateRouteError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
