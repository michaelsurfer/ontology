import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TemplateDefinition, TemplateSummary } from './types.js';

const templateModuleDirectory = path.dirname(fileURLToPath(import.meta.url));
const templatesDirectory = path.join(templateModuleDirectory, 'templates');

// Resolve the folder that holds template JSON files.
export function getTemplatesDirectory(): string {
  return templatesDirectory;
}

// Load and validate one template JSON file by id (filename without .json).
export function loadTemplateById(templateId: string): TemplateDefinition {
  const normalizedId = normalizeTemplateId(templateId);
  const templateFilePath = path.join(templatesDirectory, `${normalizedId}.json`);

  if (!fs.existsSync(templateFilePath)) {
    throw new Error(`Template not found: ${normalizedId}`);
  }

  const rawText = fs.readFileSync(templateFilePath, 'utf8');
  const parsed = JSON.parse(rawText) as TemplateDefinition;

  if (!parsed.name || !parsed.description) {
    throw new Error(`Template ${normalizedId} must include name and description`);
  }

  if (!Array.isArray(parsed.entities) || parsed.entities.length === 0) {
    throw new Error(`Template ${normalizedId} must include at least one entity`);
  }

  if (!Array.isArray(parsed.workflows) || parsed.workflows.length === 0) {
    throw new Error(`Template ${normalizedId} must include at least one workflow`);
  }

  return {
    ...parsed,
    id: parsed.id || normalizedId,
  };
}

// List all template summaries from JSON files in the templates directory.
export function listTemplateSummaries(): TemplateSummary[] {
  if (!fs.existsSync(templatesDirectory)) {
    return [];
  }

  const fileNames = fs
    .readdirSync(templatesDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  const summaries: TemplateSummary[] = [];

  for (const fileName of fileNames) {
    const templateId = fileName.replace(/\.json$/i, '');
    try {
      const template = loadTemplateById(templateId);
      summaries.push({
        id: template.id,
        name: template.name,
        description: template.description,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summaries.push({
        id: templateId,
        name: templateId,
        description: `Invalid template file: ${message}`,
      });
    }
  }

  return summaries;
}

// Sanitize template id from URL or CLI argument.
export function normalizeTemplateId(rawValue: string): string {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed || !/^[a-z0-9][a-z0-9_-]*$/i.test(trimmed)) {
    throw new Error('Invalid template id');
  }
  return trimmed;
}
