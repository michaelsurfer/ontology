import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load KEY=VALUE lines from a .env file into process.env (does not override existing vars).
export function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Load optional .env files from the dashboard backend folder and repository root.
export function loadDashboardEnvironmentFiles(): void {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const backendRoot = path.resolve(moduleDirectory, '..');
  const repositoryRoot = path.resolve(backendRoot, '../..');

  loadEnvFile(path.join(backendRoot, '.env'));
  loadEnvFile(path.join(repositoryRoot, '.env'));
  loadEnvFile(path.join(repositoryRoot, 'backend', '.env'));
}
