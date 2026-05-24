import { createOpenAiClient, completeJsonFromOpenAi } from '../openaiClient.js';
import { dataLayerClient } from '../dataLayerClient.js';
import type { EntityFieldDefinition } from '../types.js';
import { resolvePrimaryEntityIdForTemplate } from './templateResolver.js';
import type { TemplateDefinition } from './types.js';

const maxCharactersForModel = 120_000;

export type ExtractedDocumentResult = {
  fileName: string;
  extractionMethod: 'json' | 'csv' | 'text' | 'openai';
  records: Record<string, unknown>[];
  summary: string;
};

// Extract workflow records from an uploaded file using the template entity schema.
export async function extractDocumentForTemplate(options: {
  templateId: string;
  template: TemplateDefinition;
  primaryWorkflowId: number;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
}): Promise<ExtractedDocumentResult> {
  const extension = readFileExtension(options.fileName);
  const plainText = await readPlainTextFromUpload({
    extension,
    mimeType: options.mimeType,
    fileBuffer: options.fileBuffer,
  });

  if (extension === 'json') {
    return {
      fileName: options.fileName,
      extractionMethod: 'json',
      records: parseJsonRecords(plainText),
      summary: 'Parsed structured JSON input.',
    };
  }

  if (extension === 'csv') {
    return {
      fileName: options.fileName,
      extractionMethod: 'csv',
      records: parseCsvRecords(plainText),
      summary: 'Parsed CSV rows into records.',
    };
  }

  const entityId = await resolvePrimaryEntityIdForTemplate(
    options.templateId,
    options.primaryWorkflowId,
  );
  if (!entityId) {
    throw new Error('Could not resolve target record type from template workflow');
  }

  const entityDefinition = await dataLayerClient.getEntity(entityId);
  const activeFields = entityDefinition.fields.filter((field) => field.is_active !== false);

  const openAiClient = createOpenAiClient();
  if (!openAiClient) {
    throw new Error(
      'Document extraction requires OPENAI_API_KEY for non-JSON/CSV files. Upload .json or .csv, or configure OpenAI.',
    );
  }

  const records = await extractRecordsWithOpenAi({
    openAiClient,
    fileName: options.fileName,
    plainText,
    entityDisplayName: entityDefinition.display_name || entityDefinition.name,
    fields: activeFields,
  });

  return {
    fileName: options.fileName,
    extractionMethod: plainText.length > 0 ? 'openai' : 'text',
    records,
    summary: `Extracted ${records.length} record(s) for ${entityDefinition.display_name}.`,
  };
}

// Parse JSON file into one or many workflow records.
function parseJsonRecords(plainText: string): Record<string, unknown>[] {
  const parsed = JSON.parse(plainText) as unknown;
  if (Array.isArray(parsed)) {
    return parsed
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>);
  }
  if (parsed && typeof parsed === 'object') {
    const objectValue = parsed as Record<string, unknown>;
    if (Array.isArray(objectValue.records)) {
      return objectValue.records
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => item as Record<string, unknown>);
    }
    return [objectValue];
  }
  throw new Error('JSON file must be an object or array of objects');
}

// Parse simple CSV into records using the header row.
function parseCsvRecords(plainText: string): Record<string, unknown>[] {
  const lines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV file must include a header row and at least one data row');
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeFieldKey(header));
  const records: Record<string, unknown>[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = splitCsvLine(lines[lineIndex]);
    const record: Record<string, unknown> = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const fieldName = headers[columnIndex];
      if (!fieldName) {
        continue;
      }
      record[fieldName] = values[columnIndex] ?? '';
    }
    records.push(record);
  }

  return records;
}

// Split one CSV line respecting quoted commas.
function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (character === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
      continue;
    }
    currentValue += character;
  }

  values.push(currentValue.trim());
  return values;
}

function normalizeFieldKey(rawValue: string): string {
  return String(rawValue || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Use OpenAI to map document text into entity field keys.
async function extractRecordsWithOpenAi(options: {
  openAiClient: import('openai').OpenAI;
  fileName: string;
  plainText: string;
  entityDisplayName: string;
  fields: EntityFieldDefinition[];
}): Promise<Record<string, unknown>[]> {
  const fieldDescriptions = options.fields.map((field) => {
    const hintParts = [
      field.description,
      field.example ? `example: ${field.example}` : '',
      field.extraction_hint ? `hint: ${field.extraction_hint}` : '',
    ].filter(Boolean);
    return `- ${field.field_name} (${field.field_type}${field.is_required ? ', required' : ''}): ${hintParts.join(' · ')}`;
  });

  const truncatedText = options.plainText.slice(0, maxCharactersForModel);
  const systemPrompt =
    'You extract structured business records from documents. Reply with JSON only. ' +
    'Use field_name keys exactly as provided. Return one object when the document describes a single record.';

  const userPrompt =
    `Target record type: ${options.entityDisplayName}\n` +
    `File name: ${options.fileName}\n\n` +
    'Fields:\n' +
    `${fieldDescriptions.join('\n')}\n\n` +
    'Return JSON with shape:\n' +
    '{"records":[{"field_name":"value"}]}\n\n' +
    'Document text:\n---\n' +
    `${truncatedText}\n---`;

  const parsed = await completeJsonFromOpenAi({
    openAiClient: options.openAiClient,
    systemPrompt,
    userPrompt,
  });

  const recordsValue = parsed.records;
  if (Array.isArray(recordsValue)) {
    return recordsValue
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>);
  }

  const keys = Object.keys(parsed).filter((key) => key !== 'summary');
  if (keys.length > 0) {
    return [parsed];
  }

  return [];
}

// Read upload bytes as UTF-8 text, with optional PDF parsing.
async function readPlainTextFromUpload(options: {
  extension: string;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<string> {
  if (options.extension === 'pdf' || options.mimeType.includes('pdf')) {
    return readPdfPlainText(options.fileBuffer);
  }

  return options.fileBuffer.toString('utf8');
}

// Extract text from a PDF buffer using pdf-parse v2.
async function readPdfPlainText(fileBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: fileBuffer });
    try {
      const textResult = await parser.getText();
      return String(textResult.text || '');
    } finally {
      await parser.destroy();
    }
  } catch {
    throw new Error('PDF parsing failed. Upload .txt, .json, or .csv instead.');
  }
}

function readFileExtension(fileName: string): string {
  const parts = String(fileName || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
