import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlaybookDefinition, PlaybookSummary } from './types.js';

const playbookModuleDirectory = path.dirname(fileURLToPath(import.meta.url));
const playbooksDirectory = path.join(playbookModuleDirectory, 'playbooks');

// Resolve the folder that holds playbook JSON files.
export function getPlaybooksDirectory(): string {
  return playbooksDirectory;
}

// Load and validate one playbook JSON file by id (filename without .json).
export function loadPlaybookById(playbookId: string): PlaybookDefinition {
  const normalizedId = normalizePlaybookId(playbookId);
  const playbookFilePath = path.join(playbooksDirectory, `${normalizedId}.json`);

  if (!fs.existsSync(playbookFilePath)) {
    throw new Error(`Playbook not found: ${normalizedId}`);
  }

  const rawText = fs.readFileSync(playbookFilePath, 'utf8');
  const parsed = JSON.parse(rawText) as PlaybookDefinition;

  if (!parsed.name || !parsed.description) {
    throw new Error(`Playbook ${normalizedId} must include name and description`);
  }

  if (!Array.isArray(parsed.entities) || parsed.entities.length === 0) {
    throw new Error(`Playbook ${normalizedId} must include at least one entity`);
  }

  if (!Array.isArray(parsed.workflows) || parsed.workflows.length === 0) {
    throw new Error(`Playbook ${normalizedId} must include at least one workflow`);
  }

  return {
    ...parsed,
    id: parsed.id || normalizedId,
  };
}

// List all playbook summaries from JSON files in the playbooks directory.
export function listPlaybookSummaries(): PlaybookSummary[] {
  if (!fs.existsSync(playbooksDirectory)) {
    return [];
  }

  const fileNames = fs
    .readdirSync(playbooksDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  const summaries: PlaybookSummary[] = [];

  for (const fileName of fileNames) {
    const playbookId = fileName.replace(/\.json$/i, '');
    try {
      const playbook = loadPlaybookById(playbookId);
      summaries.push({
        id: playbook.id,
        name: playbook.name,
        description: playbook.description,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summaries.push({
        id: playbookId,
        name: playbookId,
        description: `Invalid playbook file: ${message}`,
      });
    }
  }

  return summaries;
}

// Sanitize playbook id from URL or CLI argument.
export function normalizePlaybookId(rawValue: string): string {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed || !/^[a-z0-9][a-z0-9_-]*$/i.test(trimmed)) {
    throw new Error('Invalid playbook id');
  }
  return trimmed;
}
